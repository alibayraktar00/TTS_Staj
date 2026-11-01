# CorpSuite Project

A full-stack corporate management system with Express backend and React frontend.

## Project Structure

```
tts/
├── backend/
│   ├── .env                 ← Environment variables (copy from .env.example)
│   ├── .env.example        
│   ├── authRoutes.js       ← Authentication routes
│   ├── db.js               ← Database connection
│   ├── package.json
│   ├── schema.sql          ← Database schema
│   └── server.js           ← Express server
│
├── frontend/
│   ├── public/
│   │   └── index.html      
│   ├── src/
│   │   ├── App.jsx         ← Main App component
│   │   ├── api.js          ← Axios API setup
│   │   ├── Dashboard.jsx   ← Dashboard component
│   │   ├── index.js        ← React entry point
│   │   └── LoginPage.jsx   ← Login component
│   └── package.json
│
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js 14+
- MySQL Server

### Backend Setup

1. Copy environment variables:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `.env` file with your database credentials and JWT secret

3. Create the database:
   ```bash
   mysql -u root -p < schema.sql
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start the server:
   ```bash
   npm start
   ```
   Server will run on `http://localhost:5000`

### Frontend Setup

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```
   App will open on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username and password
- `POST /api/auth/register` - Register new user

## Technologies

**Backend:**
- Express.js
- MySQL2
- JWT (JSON Web Tokens)
- bcryptjs (password hashing)

**Frontend:**
- React 18
- Axios
- CSS-in-JS

## Environment Variables

### Backend (.env)
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=corpsuite
DB_PORT=3306
JWT_SECRET=your_secret_key
PORT=5000
NODE_ENV=development
```

## License

ISC
