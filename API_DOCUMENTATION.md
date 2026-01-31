# Glass E-commerce API Documentation

## User Authentication & Profile
```
POST /api/users/register
POST /api/users/login
GET /api/users/profile
PUT /api/users/profile

POST /api/users/addresses
PUT /api/users/addresses/:addressId
DELETE /api/users/addresses/:addressId
```

## Shopping Cart
```
GET /api/cart
POST /api/cart/add
PUT /api/cart/item/:itemId
DELETE /api/cart/item/:itemId
DELETE /api/cart/clear
```

## Wishlist
```
GET /api/wishlist
POST /api/wishlist/add
POST /api/wishlist/toggle
DELETE /api/wishlist/:productId
```

## User Orders
```
POST /api/user-orders/place
GET /api/user-orders
GET /api/user-orders/:orderId
PUT /api/user-orders/:orderId/cancel
GET /api/user-orders/:orderId/track
```

## Products (Public)
```
GET /api/products
GET /api/products/:idOrSlug
```

## Categories (Public)
```
GET /api/categories
GET /api/categories/:idOrSlug
```

## Offers (Public)
```
GET /api/offers
GET /api/offers/:code/validate
```

## Admin Routes (Protected)
```
POST /api/admin/create
POST /api/admin/login
GET /api/admin/list
POST /api/admin/logout-all
POST /api/admin/change-password

POST /api/products (with image upload)
PUT /api/products/:idOrSlug
DELETE /api/products/:idOrSlug

POST /api/categories
PUT /api/categories/:idOrSlug
DELETE /api/categories/:idOrSlug

GET /api/orders
GET /api/orders/:orderId
PUT /api/orders/:orderId

GET /api/dashboard
```

## Sample User Flow

### 1. User Registration
```json
POST /api/users/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "password123"
}
```

### 2. User Login
```json
POST /api/users/login
{
  "email": "john@example.com",
  "password": "password123"
}
```

### 3. Add to Cart
```json
POST /api/cart/add
{
  "productId": "product_id_here",
  "quantity": 2,
  "size": "Medium",
  "color": "Black",
  "addOnName": "Anti-glare coating",
  "addOnPrice": 500
}
```

### 4. Add to Wishlist
```json
POST /api/wishlist/add
{
  "productId": "product_id_here"
}
```

### 5. Add Address
```json
POST /api/users/addresses
{
  "name": "John Doe",
  "phone": "9876543210",
  "addressLine1": "123 Main Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "isDefault": true
}
```

### 6. Place Order
```json
POST /api/user-orders/place
{
  "addressId": "address_id_here",
  "paymentMethod": "COD",
  "offerCode": "SAVE10",
  "notes": "Please handle with care"
}
```

### 7. Track Order
```
GET /api/user-orders/order_id_here/track
```

## Authentication
- All user routes (except register/login) require Bearer token
- Include in header: `Authorization: Bearer your_jwt_token`
- Admin routes use separate authentication system

## Response Format
```json
{
  "message": "Success message",
  "data": {},
  "error": "Error message if any"
}
```