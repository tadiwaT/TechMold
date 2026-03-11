# TechMold POS System

A professional, full-featured Point of Sale (POS) system built for TechMold tech shop. Built with Next.js 14, Supabase, TypeScript, and Tailwind CSS.

![TechMold POS](https://via.placeholder.com/1280x720/080c10/00D4FF?text=TechMold+POS)

## ✨ Features

### 🛒 POS Terminal
- Fast product search by name, SKU, or barcode
- Category filtering for quick navigation
- Real-time cart management with quantity controls
- Item-level and cart-level discounts
- Customer association with loyalty points
- Multiple payment methods (Cash, Card, EcoCash, Bank Transfer)
- Automatic change calculation for cash payments
- Automatic receipt number generation (TM-YYYYMMDD-XXXX)

### 📦 Inventory Management
- Complete product CRUD (Create, Read, Update, Delete)
- Stock level tracking with low-stock alerts
- Manual stock adjustment with movement history
- Product activation/deactivation
- Barcode support
- Cost price vs selling price tracking
- Profit margin visibility

### 👥 Customer Management
- Customer profiles with contact information
- Loyalty points system (1 point per $10 spent)
- Purchase history tracking
- Total spend and visit count analytics
- Quick search by name, email, or phone

### 📊 Reports & Analytics
- Revenue trends with interactive charts (Area, Bar, Pie)
- Period filters: Today, Week, Month, Year
- KPI cards with period-over-period comparison
- Top products by revenue
- Payment method breakdown
- Recent transactions list

### ⚙️ Settings
- Store information configuration
- Staff profile management
- Password change
- System information

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (free tier works)

### 1. Clone & Install

```bash
git clone <your-repo>
cd techmold-pos
npm install
```

### 2. Set Up Supabase

1. Go to [app.supabase.com](https://app.supabase.com) and create a new project
2. Once created, go to **Settings → API** and copy:
   - Project URL
   - `anon` public key

3. Go to **SQL Editor** and run the entire contents of `lib/schema.sql`
   - This creates all tables, RLS policies, triggers, functions, and seed data

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Create Your First User

1. In Supabase dashboard, go to **Authentication → Users**
2. Click **Add User** → Enter email and password
3. The trigger will auto-create a profile with `cashier` role
4. To make someone an admin, run in SQL Editor:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = 'user-uuid-here';
   ```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Build for Production

```bash
npm run build
npm start
```

## 🏗️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Next.js 14** | React framework with App Router |
| **TypeScript** | Type safety |
| **Supabase** | Database, Auth, Real-time |
| **Tailwind CSS** | Styling |
| **Zustand** | Cart state management (with persistence) |
| **Recharts** | Analytics charts |
| **react-hot-toast** | Notifications |
| **Zod** | Schema validation |

## 🗄️ Database Schema

```
profiles          - Staff user profiles (linked to auth.users)
products          - Product catalog with inventory
categories        - Product categories
customers         - Customer profiles with loyalty
sales             - Transaction headers
sale_items        - Transaction line items  
stock_movements   - Inventory audit trail
notifications     - System alerts
```

### Key Database Features
- **Row Level Security (RLS)** on all tables
- **Automatic receipt numbers** via PostgreSQL sequence
- **Stock deduction trigger** on sale_items insert
- **Customer stats update trigger** on sale completion
- **Low stock alert trigger** on stock update
- **Automatic profile creation** on user signup

## 📱 Mobile Support

The POS is fully responsive and works across:
- Desktop browsers (optimal for cashier stations)
- Tablets (iPad, Android tablets)
- Mobile phones (emergency use)
- Installable as PWA (add to home screen)

## 🔐 Roles & Permissions

| Feature | Cashier | Manager | Admin |
|---------|---------|---------|-------|
| POS Sales | ✅ | ✅ | ✅ |
| View Inventory | ✅ | ✅ | ✅ |
| Edit Products | ❌ | ✅ | ✅ |
| View Reports | ✅ | ✅ | ✅ |
| Manage Staff | ❌ | ❌ | ✅ |

## 🛠️ Development

### Project Structure
```
techmold-pos/
├── app/
│   ├── auth/login/      # Authentication
│   ├── dashboard/
│   │   ├── pos/         # Main POS terminal
│   │   ├── inventory/   # Product management
│   │   ├── customers/   # Customer CRM
│   │   ├── reports/     # Analytics
│   │   └── settings/    # Configuration
│   ├── layout.tsx
│   └── page.tsx         # Root redirect
├── components/          # Shared components
├── lib/
│   ├── supabase/        # Supabase clients
│   ├── utils.ts         # Helper functions
│   └── schema.sql       # Database schema
├── store/
│   └── cart.ts          # Zustand cart store
├── types/
│   └── index.ts         # TypeScript types
└── middleware.ts        # Auth middleware
```

## 🐛 Troubleshooting

**"Failed to load products"** — Check your Supabase URL and anon key in `.env.local`

**"RLS policy violation"** — Make sure you're logged in; all tables require authentication

**"Stock not deducting"** — Ensure the `on_sale_item_created` trigger was created (run schema.sql again)

**Cart not persisting** — Zustand persists to localStorage. Clear browser storage to reset.

## 📄 License

MIT License - Free for commercial use.

---

Built with ❤️ for TechMold by the development team.
