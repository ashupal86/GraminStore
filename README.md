# GraminStore - Dual-Role PWA for Merchants and Consumers

A comprehensive Progressive Web Application (PWA) that bridges merchants and consumers with powerful transaction management, real-time analytics, and seamless payment solutions for modern businesses.

## 🌟 Features

### For Merchants
- **Real-time Dashboard**: Bento-grid analytics with sales insights, top customers, and revenue tracking
- **Transaction Management**: Handle instant payments and pay-later transactions with MyManager Calculator interface
- **Guest User Management**: Simplified one-to-one guest user system for quick transactions
- **Inventory Management**: Track products, manage stock, and generate purchase lists
- **Order Management**: Comprehensive order tracking and status updates
- **Analytics**: Detailed insights with weekly and monthly breakdowns

### For Consumers
- **Expense Tracking**: Weekly and monthly expense breakdowns by merchant
- **Bill Management**: Track due and paid bills across different merchants
- **Transaction History**: Comprehensive payment history and analytics
- **Marketplace**: Browse and discover merchants and their offerings

### Technical Features
- **PWA Support**: Installable on mobile devices with offline capabilities
- **Real-time Updates**: WebSocket support for live transaction updates
- **Multi-language Support**: English, Spanish, French, and Hindi
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark Mode**: Modern UI with dark/light theme support

## 🚀 Live Demo

- **Frontend**: [https://graminstore.devinit.in](https://graminstore.devinit.in)
- **Backend API**: [https://graminstore-backend-53e13181bd39.herokuapp.com](https://graminstore-backend-53e13181bd39.herokuapp.com)
- **API Documentation**: [https://graminstore-backend-53e13181bd39.herokuapp.com/docs](https://graminstore-backend-53e13181bd39.herokuapp.com/docs)

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Router** for navigation
- **PWA** capabilities with service workers
- **i18next** for internationalization

### Backend
- **FastAPI** (Python 3.12)
- **PostgreSQL** database
- **SQLAlchemy** ORM
- **Alembic** for database migrations
- **JWT** authentication
- **WebSocket** support for real-time updates
- **Redis** for caching (optional)

### Deployment
- **Frontend**: Vercel
- **Backend**: Heroku
- **Database**: PostgreSQL (Heroku Postgres)

## 📦 Installation & Setup

### Prerequisites
- Node.js 20+ (for frontend)
- Python 3.12+ (for backend)
- PostgreSQL 12+
- Git

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ashupal86/GraminStore.git
   cd GraminStore/backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and other settings
   ```

5. **Run database migrations**
   ```bash
   alembic upgrade head
   ```

6. **Start the server**
   ```bash
   uvicorn app.main:app --reload --port 8009
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API URL
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🗄️ Database Population

The application includes a comprehensive database population system for development and testing purposes.

### Using the API Endpoint

**Endpoint**: `POST /api/v1/admin/populate-database`

**Example Request**:
```bash
curl -X POST https://graminstore-backend-53e13181bd39.herokuapp.com/api/v1/admin/populate-database
```

**Response**:
```json
{
  "success": true,
  "message": "Database populated successfully!",
  "data": {
    "merchants": 104,
    "users": 1757,
    "guest_users": 3856,
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "test_credentials": {
    "admin": {
      "email": "admin@graminstore.com",
      "password": "admin123"
    },
    "test_merchant": {
      "email": "test@example.com",
      "password": "Merchant123"
    },
    "merchants": {
      "password": "merchant123"
    },
    "users": {
      "password": "user123"
    }
  }
}
```

### What Gets Created

The database population script creates:

- **Admin User**: `admin@graminstore.com` / `admin123`
- **Test Merchant**: `test@example.com` / `Merchant123`
- **2 Additional Merchants**: Various business types with realistic Indian data
- **4 Regular Users**: With Indian names and phone numbers
- **100+ User Transactions**: Per merchant with realistic amounts and descriptions
- **100+ Guest Transactions**: Per merchant using the simplified guest user system

### Test Credentials

After running the database population:

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| Admin | admin@graminstore.com | admin123 | Full system access |
| Test Merchant | test@example.com | Merchant123 | Pre-configured merchant |
| Merchants | [generated] | merchant123 | Random merchants |
| Users | [generated] | user123 | Random users |

## 🔧 Development

### Project Structure

```
GraminStore/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # API routes
│   │   ├── models/          # Database models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utilities
│   ├── requirements.txt
│   └── Procfile
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript types
│   │   └── locales/        # i18n translations
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

### API Endpoints

#### Authentication
- `POST /api/v1/auth/register/merchant` - Register merchant
- `POST /api/v1/auth/register/user` - Register user
- `POST /api/v1/auth/login/merchant` - Merchant login
- `POST /api/v1/auth/login/user` - User login

#### Transactions
- `POST /api/v1/transactions/create` - Create transaction
- `GET /api/v1/transactions/history` - Get transaction history
- `GET /api/v1/transactions/analytics` - Get analytics

#### Dashboard
- `GET /api/v1/dashboard/merchant` - Merchant dashboard
- `GET /api/v1/dashboard/user` - User dashboard

#### Admin
- `POST /api/v1/admin/populate-database` - Populate database with test data
- `GET /api/v1/admin/database-status` - Get database status

#### WebSocket
- `WS /api/v1/ws/orders/{token}` - Real-time order updates

### Database Schema

#### Core Tables
- `merchants` - Merchant information and business details
- `users` - Regular user accounts
- `guest_users` - Simplified guest user system
- `transactions` - Dynamic transaction tables per merchant

#### Key Features
- **Dynamic Tables**: Each merchant gets their own transaction table
- **Guest User System**: Simplified one-to-one guest user management
- **Audit Trail**: Complete transaction history with timestamps
- **Flexible Schema**: Supports various transaction types and payment methods

## 🚀 Deployment

### Backend (Heroku)

1. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

2. **Add PostgreSQL addon**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

3. **Set environment variables**
   ```bash
   heroku config:set SECRET_KEY=your-secret-key
   heroku config:set ADMIN_EMAIL=admin@yourdomain.com
   heroku config:set ADMIN_PASSWORD=your-admin-password
   ```

4. **Deploy**
   ```bash
   git subtree push --prefix=backend heroku main
   ```

### Frontend (Vercel)

1. **Connect GitHub repository to Vercel**
2. **Set build settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Set environment variables**:
   - `VITE_API_URL`: Your backend API URL
4. **Deploy**

## 🔒 Security

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **CORS Protection**: Configured for specific domains
- **Input Validation**: Pydantic schemas for request validation
- **SQL Injection Protection**: SQLAlchemy ORM prevents SQL injection

## 🌐 Internationalization

The application supports multiple languages:
- English (en)
- Spanish (es)
- French (fr)
- Hindi (hi)

Language files are located in `frontend/src/locales/`.

## 📱 PWA Features

- **Installable**: Add to home screen on mobile devices
- **Offline Support**: Service worker for offline functionality
- **Push Notifications**: Real-time updates (when WebSocket is available)
- **Responsive Design**: Optimized for all screen sizes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Backend Development**: FastAPI, PostgreSQL, SQLAlchemy
- **Frontend Development**: React, TypeScript, Tailwind CSS
- **DevOps**: Heroku, Vercel
- **UI/UX**: Modern, responsive design with PWA capabilities

## 📞 Support

For support and questions:
- **Email**: support@graminstore.com
- **Issues**: [GitHub Issues](https://github.com/ashupal86/GraminStore/issues)
- **Documentation**: [API Docs](https://graminstore-backend-53e13181bd39.herokuapp.com/docs)

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics and reporting
- [ ] Payment gateway integration
- [ ] Multi-tenant support
- [ ] Advanced inventory management
- [ ] Customer loyalty programs
- [ ] API rate limiting and monitoring
- [ ] Advanced security features

---

**GraminStore** - Empowering merchants and consumers with modern transaction management solutions. 🚀