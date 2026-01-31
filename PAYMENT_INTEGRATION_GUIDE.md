#### Payment APIs:
- `POST /api/payment/create-order` - Create Razorpay order
- `POST /api/payment/verify` - Verify payment & create order
- `POST /api/payment/failure` - Handle payment failure

#### Cart API:
- `GET /api/cart/total` - Get cart total for payment

## 📱 Frontend Integration

### 1. Get Cart Total
```javascript
const getCartTotal = async () => {
  const response = await fetch('/api/cart/total', {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  return response.json();
};
```

### 2. Create Payment Order
```javascript
const createPaymentOrder = async (amount) => {
  const response = await fetch('/api/payment/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({ amount })
  });
  return response.json();
};
```

### 3. Initialize Razorpay Payment
```javascript
const initiatePayment = async (cartTotal, shippingAddress) => {
  try {
    // Create order
    const orderData = await createPaymentOrder(cartTotal);
    
    const options = {
      key: orderData.key_id,
      amount: orderData.order.amount,
      currency: orderData.order.currency,
      name: "Glass E-Commerce",
      description: "Order Payment",
      order_id: orderData.order.id,
      handler: async (response) => {
        // Payment success
        await verifyPayment(response, shippingAddress);
      },
      prefill: {
        name: "Customer Name",
        email: "customer@example.com",
        contact: "9999999999"
      },
      theme: {
        color: "#3399cc"
      },
      modal: {
        ondismiss: () => {
          // Payment cancelled
          handlePaymentFailure("Payment cancelled by user");
        }
      }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
  } catch (error) {
    console.error('Payment initiation failed:', error);
  }
};
```

### 4. Verify Payment
```javascript
const verifyPayment = async (paymentResponse, shippingAddress) => {
  try {
    const response = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        shippingAddress,
        notes: "Order from website"
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Payment successful - redirect to success page
      window.location.href = `/order-success/${result.order._id}`;
    } else {
      // Payment verification failed
      handlePaymentFailure(result.message);
    }
  } catch (error) {
    handlePaymentFailure("Payment verification failed");
  }
};
```

### 5. Handle Payment Failure
```javascript
const handlePaymentFailure = async (errorMessage) => {
  try {
    await fetch('/api/payment/failure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        error: { description: errorMessage }
      })
    });
    
    // Show error message to user
    alert(`Payment failed: ${errorMessage}`);
    
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
};
```

## 🔧 Complete Payment Flow

### HTML (Add Razorpay script)
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### Complete Example
```javascript
// Complete payment flow
const processPayment = async () => {
  try {
    // 1. Get cart total
    const cartData = await getCartTotal();
    
    // 2. Get shipping address (from form)
    const shippingAddress = {
      name: "John Doe",
      phone: "9999999999",
      email: "john@example.com",
      addressLine1: "123 Main St",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001"
    };
    
    // 3. Initiate payment
    await initiatePayment(cartData.totalAmount, shippingAddress);
    
  } catch (error) {
    console.error('Payment process failed:', error);
    alert('Payment process failed. Please try again.');
  }
};
```

## 📋 Testing

### Test Cards (Razorpay Test Mode):
- **Success**: 4111 1111 1111 1111
- **Failure**: 4000 0000 0000 0002
- **CVV**: Any 3 digits
- **Expiry**: Any future date

## 🔒 Security Features Implemented

1. **Signature Verification**: Validates payment authenticity
2. **User Authentication**: All endpoints require valid JWT
3. **Cart Validation**: Ensures cart exists and has items
4. **Order Creation**: Only on successful payment verification
5. **Error Handling**: Proper error messages for failed payments

## 📝 Order Status Flow

1. **Payment Initiated** → `status: "pending"`, `paymentStatus: "pending"`
2. **Payment Success** → `status: "confirmed"`, `paymentStatus: "paid"`
3. **Payment Failed** → Order not created, user notified
