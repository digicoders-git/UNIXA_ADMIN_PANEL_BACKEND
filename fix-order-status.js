// ADMIN update status - FIXED VERSION
// Replace the updateOrderStatus function in orderController.js with this:

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const oldStatus = order.status;

    if (status) {
      order.status = status;
      if (status === 'confirmed' && !order.confirmedAt) order.confirmedAt = new Date();
      if (status === 'shipped' && !order.shippedAt) order.shippedAt = new Date();
      if (status === 'delivered' && !order.deliveredAt) order.deliveredAt = new Date();
      if (status === 'cancelled' && !order.cancelledAt) order.cancelledAt = new Date();
    }
    if (paymentStatus) order.paymentStatus = paymentStatus;

    await order.save();
    const savedOrder = order.toObject();

    // Auto-create UserAMC when order is delivered (async, don't wait)
    if (status === 'delivered' && oldStatus !== 'delivered' && order.userId) {
      setImmediate(async () => {
        try {
          console.log('🎯 Order delivered, activating AMC plans...');
          console.log('Order ID:', order._id);
          console.log('User ID:', order.userId);

          for (const item of order.items) {
            console.log(`\nProcessing item: ${item.productName}`);

            // Check if customer selected specific AMC
            if (item.amcPlan && item.amcId) {
              console.log('  ✅ Customer selected AMC, using that...');
              const selectedPlan = await AmcPlan.findById(item.amcPlan);
              if (!selectedPlan || !selectedPlan.isActive) {
                console.log('  ⏭️  AMC plan not found or inactive');
                continue;
              }

              const startDate = new Date();
              const endDate = new Date();
              endDate.setMonth(endDate.getMonth() + (selectedPlan.durationMonths || 12));

              const userAmc = await UserAmc.create({
                userId: order.userId,
                orderId: order._id,
                amcId: item.amcId,
                productId: item.product,
                productType: item.productType || 'Product',
                productName: item.productName,
                productImage: item.productImage,
                amcPlanId: selectedPlan._id,
                amcPlanName: selectedPlan.name,
                amcPlanPrice: selectedPlan.price,
                durationMonths: selectedPlan.durationMonths || 12,
                startDate,
                endDate,
                servicesTotal: selectedPlan.servicesIncluded || 4,
                servicesUsed: 0,
                partsIncluded: selectedPlan.partsIncluded || false,
                status: 'Active',
                paymentStatus: 'Paid',
                amountPaid: item.amcPrice || selectedPlan.price
              });

              console.log(`  ✅ AMC activated! UserAmc ID: ${userAmc._id}`);
            } else {
              // No AMC selected by customer, check if product has AMC plans
              console.log('  ℹ️  No AMC selected, checking product AMC plans...');

              let productData = null;
              if (item.productType === 'RoPart') {
                productData = await RoPart.findById(item.product).populate('amcPlans');
              } else {
                productData = await Product.findById(item.product).populate('amcPlans');
              }

              if (!productData || !productData.amcPlans || productData.amcPlans.length === 0) {
                console.log('  ⏭️  No AMC plans available for this product');
                continue;
              }

              // Get first active AMC plan
              const firstActivePlan = productData.amcPlans.find(p => p && p.isActive !== false);
              if (!firstActivePlan) {
                console.log('  ⏭️  No active AMC plans found');
                continue;
              }

              console.log(`  📦 Auto-activating first AMC plan: ${firstActivePlan.name}`);

              const startDate = new Date();
              const endDate = new Date();
              endDate.setMonth(endDate.getMonth() + (firstActivePlan.durationMonths || 12));

              const userAmc = await UserAmc.create({
                userId: order.userId,
                orderId: order._id,
                amcId: `AMC${Date.now()}${Math.floor(Math.random() * 1000)}`,
                productId: item.product,
                productType: item.productType || 'Product',
                productName: item.productName,
                productImage: item.productImage,
                amcPlanId: firstActivePlan._id,
                amcPlanName: firstActivePlan.name,
                amcPlanPrice: firstActivePlan.price,
                durationMonths: firstActivePlan.durationMonths || 12,
                startDate,
                endDate,
                servicesTotal: firstActivePlan.servicesIncluded || 4,
                servicesUsed: 0,
                partsIncluded: firstActivePlan.partsIncluded || false,
                status: 'Active',
                paymentStatus: 'Paid',
                amountPaid: firstActivePlan.price
              });

              console.log(`  ✅ AMC auto-activated! UserAmc ID: ${userAmc._id}`);
            }
          }

          console.log('🎉 AMC activation completed!');
        } catch (amcErr) {
          console.error('❌ Error activating AMC (background):', amcErr.message);
        }
      });
    }

    res.json({ message: "Order updated", order: savedOrder });
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
