# 🏪 GraminStore Backend API

A comprehensive backend API for a dual-role PWA application serving both **Merchants** and **Consumers**. Built with FastAPI, PostgreSQL, and modern web technologies.

## 🚀 Features

### 🛍️ For Merchants
- **MyManager Calculator**: Create transactions directly with calculation interface
- **Real-time Dashboard**: Bento-grid analytics with sales, top customers, revenue insights
- **Transaction Management**: Handle both instant payments and pay-later transactions
- **Guest User Management**: Simplified one-to-one guest user system
- **WebSocket Updates**: Real-time transaction history updates

### 👤 For Users/Consumers
- **Expense Tracking**: Weekly/monthly expense breakdowns by merchant
- **Bill Management**: Track due and paid bills across different merchants
- **Transaction History**: Complete purchase history with all merchants
- **User Dashboard**: Personal analytics and spending insights

### 🔧 Technical Features
- **JWT Authentication**: Secure login for merchants and users
- **Dynamic Transaction Tables**: Separate transaction tables per merchant
- **Simplified Guest Users**: One guest user per transaction (id, merchant_id, transaction_id, timestamp)
- **WebSocket Support**: Real-time updates and notifications
- **Admin Dashboard**: SQLAdmin interface for complete system management
- **API Versioning**: Clean v1 API structure ready for frontend integration
- **Docker Support**: Containerized PostgreSQL and application

## 📁 Project Structure

```
GraminStore/
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  │  └─ v1/
│  │  │     ├─ auth.py          # Authentication routes
│  │  │     ├─ transactions.py  # Transaction management
│  │  │     ├─ dashboard.py     # Analytics endpoints
│  │  │     ├─ websocket.py     # Real-time updates
│  │  │     └─ router.py        # Main API router
│  │  ├─ models/
│  │  │  ├─ merchant.py         # Merchant model
│  │  │  ├─ user.py             # User/consumer model
│  │  │  ├─ guest_user.py       # Guest user model
│  │  │  ├─ transaction.py      # Dynamic transaction tables
│  │  │  ├─ database.py         # Database configuration
│  │  │  └─ base.py             # Base model class
│  │  ├─ schemas/
│  │  │  ├─ auth.py             # Authentication schemas
│  │  │  ├─ transaction.py      # Transaction schemas
│  │  │  └─ dashboard.py        # Dashboard schemas
│  │  ├─ utils/
│  │  │  ├─ auth.py             # JWT utilities
│  │  │  ├─ dependencies.py     # FastAPI dependencies
│  │  │  └─ fake_data.py        # Test data generation
│  │  ├─ admin.py               # SQLAdmin configuration
│  │  ├─ config.py              # Application settings
│  │  └─ main.py                # FastAPI application
│  ├─ requirements.txt          # Python dependencies
│  └─ Dockerfile               # Docker configuration
├─ docker-compose.yml          # Docker Compose setup
└─ README.md                   # This file
```

## 🛠️ Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL (Dockerized)
- **ORM**: SQLAlchemy with dynamic table creation
- **Authentication**: JWT with bcrypt password hashing
- **Admin Interface**: SQLAdmin
- **Real-time**: WebSockets for live transaction updates
- **Validation**: Pydantic schemas
- **Containerization**: Docker & Docker Compose

## 🚀 Quick Start

### 🌐 Live Deployment (Heroku)

**GraminStore Backend is now live on Heroku!**

- **🌍 Live API**: https://graminstore-backend-53e13181bd39.herokuapp.com/
- **📚 API Documentation**: https://graminstore-backend-53e13181bd39.herokuapp.com/docs
- **⚙️ Admin Dashboard**: https://graminstore-backend-53e13181bd39.herokuapp.com/admin
- **🔍 Health Check**: https://graminstore-backend-53e13181bd39.herokuapp.com/

**Test Credentials:**
- **Admin**: admin@graminstore.com / admin123
- **Merchant**: merchant123@example.com / merchant123
- **User**: user123@example.com / user123

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- Git

### 1. Clone the Repository
```bash
git clone <repository-url>
cd GraminStore
```

### 2. Start PostgreSQL Database
```bash
docker-compose up postgres -d
```

### 3. Setup Backend Environment
```bash
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Generate Test Data
```bash
python fake_data.py
```

This will create:
- 1 admin user
- 5 merchants with realistic business data
- 100 users with Indian names and contact info
- 100+ user transactions per merchant
- 50+ guest transactions per merchant (using simplified guest user system)

### 5. Run the Backend Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

The API will be available at:
- **API Documentation**: http://localhost:8001/docs
- **Admin Dashboard**: http://localhost:8001/admin

## 🚀 Heroku Deployment

The backend is already deployed on Heroku with the following configuration:

### Deployment Details
- **Platform**: Heroku
- **Database**: Heroku Postgres (Essential-0 plan)
- **Python Version**: 3.12.0
- **Auto-deployment**: Git push to `master` branch

### Environment Variables
- `DATABASE_URL`: Automatically set by Heroku Postgres addon
- `SECRET_KEY`: Generated secure key for JWT tokens
- `ADMIN_EMAIL`: admin@graminstore.com
- `ADMIN_PASSWORD`: admin123

### Deployment Commands
```bash
# Login to Heroku
heroku login

# Create app (already done)
heroku create graminstore-backend

# Add PostgreSQL database
heroku addons:create heroku-postgresql:essential-0 --app graminstore-backend

# Set environment variables
heroku config:set SECRET_KEY="$(openssl rand -base64 32)" --app graminstore-backend
heroku config:set ADMIN_EMAIL="admin@graminstore.com" ADMIN_PASSWORD="admin123" --app graminstore-backend

# Deploy
git push heroku master
```

### Monitoring
- **Logs**: `heroku logs --tail --app graminstore-backend`
- **Status**: `heroku ps --app graminstore-backend`
- **Config**: `heroku config --app graminstore-backend`

## 📊 Database Schema

### Core Tables
- **merchants**: Store owner accounts with business details
- **users**: Consumer accounts
- **guest_users**: Simplified guest user records (id, merchant_id, transaction_id, timestamp)
- **transaction_<merchant_id>**: Dynamic tables per merchant for transactions

### Dynamic Transaction Tables
Each merchant gets their own transaction table (`transaction_1`, `transaction_2`, etc.) containing:
- Transaction ID, User ID, Guest User ID
- Timestamp, Amount, Type (paid/pay_later)
- Description, Payment method, Reference number

### Simplified Guest User System
- **One-to-One Relationship**: Each guest user corresponds to exactly one transaction
- **Minimal Data**: Only stores essential fields (id, merchant_id, transaction_id, timestamp)
- **Auto-Creation**: Guest users are automatically created when `is_guest_transaction=true`
- **No Personal Info**: No names, phones, or personal data stored in guest_users table

## 🔐 Authentication

### Registration Endpoints
- `POST /api/v1/auth/register/merchant` - Register new merchant
- `POST /api/v1/auth/register/user` - Register new consumer

### Login Endpoints
- `POST /api/v1/auth/login/merchant` - Merchant login
- `POST /api/v1/auth/login/user` - Consumer login

### Protected Routes
All API endpoints require JWT authentication via `Authorization: Bearer <token>` header.

## 📈 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register/merchant` | Register merchant |
| POST | `/api/v1/auth/register/user` | Register user |
| POST | `/api/v1/auth/login/merchant` | Merchant login |
| POST | `/api/v1/auth/login/user` | User login |
| GET | `/api/v1/auth/profile/merchant` | Get merchant profile |
| GET | `/api/v1/auth/profile/user` | Get user profile |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/transactions/create` | Create new transaction |
| GET | `/api/v1/transactions/history` | Get transaction history |
| GET | `/api/v1/transactions/analytics` | Get transaction analytics |
| POST | `/api/v1/transactions/guest-user` | Create guest user |
| GET | `/api/v1/transactions/guest-users` | List merchant's guest users |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dashboard/merchant` | Merchant dashboard stats |
| GET | `/api/v1/dashboard/user` | User dashboard stats |
| GET | `/api/v1/dashboard/user/expenses` | User expense breakdown |
| GET | `/api/v1/dashboard/merchant/top-customers` | Top customers |

### WebSocket
| Protocol | Endpoint | Description |
|----------|----------|-------------|
| WS | `/api/v1/ws/transaction-history/{token}` | Real-time transaction updates |

## 🌐 WebSocket Usage

Connect to real-time transaction updates:

```javascript
const token = "your-jwt-token";
const ws = new WebSocket(`ws://localhost:8001/api/v1/ws/transaction-history/${token}`);

// Request transaction history
ws.send(JSON.stringify({
    type: "get_transactions",
    limit: 50,
    offset: 0
}));

// Listen for new transactions
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "new_transaction") {
        // Handle new transaction notification
        console.log("New transaction:", data.data);
    }
};
```

## 👨‍💼 Admin Dashboard

Access the admin interface at http://localhost:8001/admin

**Authentication Required**:
- Username: admin
- Password: admin123

### Admin Features
- **Secure Login**: Password-protected admin interface
- **Merchant Management**: View and manage all merchants
- **User Management**: View and manage all users  
- **Guest User Tracking**: View guest user accounts
- **System Monitoring**: Monitor system activity
- **Data Access**: Access to all data across merchants
- **Session Management**: Secure session-based authentication

## 🧪 Testing

### Sample Credentials (after running fake_data.py)
**All users use password**: `merchant123` (merchants) / `user123` (users) / `admin123` (admin)

**Test Credentials**: The fake_data.py script will display all test credentials in the console output.

### Test Data Generation
The fake_data.py script creates:
- 1 admin user (admin@graminstore.com / admin123)
- 5 merchants with different business types (merchant123)
- 100 users with Indian names and contact info (user123)
- 100+ user transactions per merchant
- 50+ guest transactions per merchant (using simplified guest user system)
- Realistic transaction data with Indian business context

## 🐳 Docker Deployment

### Development (PostgreSQL only)
```bash
docker-compose up postgres -d
```

### Production (Full stack)
Uncomment the backend service in `docker-compose.yml` and run:
```bash
docker-compose up -d
```

## ⚙️ Configuration

Environment variables can be set in `app/config.py`:

```python
DATABASE_URL = "postgresql://postgres:postgres123@localhost:5432/graminstore"
SECRET_KEY = "your-super-secret-key-change-in-production"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"
```

## 🔄 Development Workflow

1. **Database Changes**: Modify models in `app/models/`
2. **New Endpoints**: Add routes in `app/api/v1/`
3. **Schemas**: Update `app/schemas/` for request/response models
4. **Testing**: Use `/docs` endpoint for interactive testing
5. **Admin**: Check data in admin dashboard at `/admin`

## 📱 Frontend Integration

This backend is designed for seamless React frontend integration:

- **RESTful APIs**: Clean JSON responses
- **JWT Authentication**: Standard Bearer token auth
- **WebSocket Support**: Real-time features
- **CORS Enabled**: Ready for frontend consumption
- **Comprehensive Documentation**: OpenAPI/Swagger specs

## 🧪 Testing Credentials

### 🔐 **Admin Dashboard**
- **URL**: http://localhost:8001/admin
- **Username**: `admin@graminstore.com`
- **Password**: `admin123`

### 🏪 **Sample Merchants** (All use password: `merchant123`)
Run `python fake_data.py` to see the generated merchant credentials in the console output.

### 👤 **Sample Users** (All use password: `user123`)
Run `python fake_data.py` to see the generated user credentials in the console output.

### 📝 **API Testing Examples**

#### Login as Merchant
```bash
curl -X POST "http://localhost:8001/api/v1/auth/login/merchant" \
-H "Content-Type: application/json" \
-d '{"email": "MERCHANT_EMAIL_FROM_SCRIPT", "password": "merchant123"}'
```

#### Login as User
```bash
curl -X POST "http://localhost:8001/api/v1/auth/login/user" \
-H "Content-Type: application/json" \
-d '{"email": "USER_EMAIL_FROM_SCRIPT", "password": "user123"}'
```

#### Create User Transaction (Merchant Token Required)
```bash
curl -X POST "http://localhost:8001/api/v1/transactions/create" \
-H "Authorization: Bearer YOUR_MERCHANT_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "user_id": 1,
  "amount": 25.50,
  "type": "payed",
  "description": "Coffee and pastry",
  "payment_method": "UPI"
}'
```

#### Create Guest Transaction (Merchant Token Required)
```bash
curl -X POST "http://localhost:8001/api/v1/transactions/create" \
-H "Authorization: Bearer YOUR_MERCHANT_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "amount": 15.75,
  "type": "pay_later",
  "description": "Lunch special",
  "payment_method": null,
  "is_guest_transaction": true
}'
```

#### Get Guest Users (Merchant Token Required)
```bash
curl -X GET "http://localhost:8001/api/v1/transactions/guest-users" \
-H "Authorization: Bearer YOUR_MERCHANT_TOKEN"
```

#### Get Merchant Dashboard (Merchant Token Required)
```bash
curl -X GET "http://localhost:8001/api/v1/dashboard/merchant" \
-H "Authorization: Bearer YOUR_MERCHANT_TOKEN"
```

#### Get User Dashboard (User Token Required)
```bash
curl -X GET "http://localhost:8001/api/v1/dashboard/user" \
-H "Authorization: Bearer YOUR_USER_TOKEN"
```

### 🎯 **Test Data Information**
The database is populated with:
- **1 admin user** for system management
- **5 merchants** with realistic Indian business data
- **100 users** with Indian names and contact information  
- **500+ user transactions** across all merchants
- **250+ guest transactions** using simplified guest user system
- **Dynamic transaction tables** for each merchant (`transaction_1`, `transaction_2`, etc.)

All test accounts use consistent passwords for easy testing!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test thoroughly
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
1. Check the API documentation at `/docs`
2. Review this README
3. Check the admin dashboard for data verification
4. Create an issue in the repository

---

**Built with ❤️ for modern e-commerce solutions**