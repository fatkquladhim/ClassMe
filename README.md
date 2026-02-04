# MAMAL - Manajemen Kelas Kuliah

Aplikasi web manajemen kelas kuliah yang dirancang untuk institusi pendidikan Islam. Aplikasi ini mengelola tiga jenis pengguna (Admin/Kurikulum, Dosen, Mahasiswa) dengan sistem privilege yang fleksibel dan hierarkis.

## Tech Stack

- **Framework**: Next.js 14+ dengan App Router
- **Database**: PostgreSQL via Supabase
- **ORM**: Drizzle ORM
- **UI**: Tailwind CSS + shadcn/ui
- **Authentication**: Custom JWT-based auth

## Features

### User Types

1. **Admin (Kurikulum)**
   - Mengelola tahun akademik dan semester
   - Mengelola kelas dan enrollment
   - Mengelola pengguna
   - Mengatur privilege dosen
   - Menunjuk Ketua Umum

2. **Dosen**
   - Dosen Pendamping
   - Wali Kelas
   - Pengurus Hafalan - mengelola hafalan mahasiswa
   - Pengurus Capaian Materi - tracking progress materi
   - Pengurus Kelas - evaluasi kelas

3. **Mahasiswa**
   - Ketua Umum - mengelola privilege mahasiswa di kelasnya
   - Ketua Kelompok
   - Kamtib (Keamanan & Ketertiban)
   - Ketua Fan Ilmu (per bidang: Fiqh, Hadits, Tafsir, dll)
   - Sekretaris
   - Bendahara

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase account)

### Installation

1. Clone repository:
   ```bash
   git clone https://github.com/fatkquladhim/mamal.git
   cd mamal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your database credentials:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/mamal
   JWT_SECRET=your-super-secret-jwt-key
   ```

5. Run database migrations:
   ```bash
   npm run db:push
   ```

6. Start development server:
   ```bash
   npm run dev
   ```

### Scripts

```bash
# Development
npm run dev

# Build
npm run build

# Start production
npm start

# Database operations
npm run db:generate  # Generate migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Auth pages (login, register)
│   ├── (dashboard)/      # Dashboard pages
│   │   ├── admin/        # Admin pages
│   │   ├── dosen/        # Dosen pages
│   │   └── mahasiswa/    # Mahasiswa pages
│   └── api/              # API routes
├── actions/              # Server actions
│   ├── admin/            # Admin actions
│   ├── dosen/            # Dosen actions
│   └── ketua-umum/       # Ketua umum actions
├── components/           # React components
│   ├── layout/           # Layout components
│   └── ui/               # UI components (shadcn)
└── lib/
    ├── auth/             # Auth utilities
    └── db/               # Database schema & connection
```

## Database Schema

Main entities:
- **users** - All system users
- **academic_years** - Academic year management
- **semesters** - Semester within academic years
- **classes** - Class management
- **class_enrollments** - Student enrollments
- **groups** - Small groups within classes
- **fan_ilmu** - Study areas (Fiqh, Hadits, etc.)
- **dosen_privileges** - Dosen role assignments
- **mahasiswa_privileges** - Student role assignments
- **hafalan_records** - Memorization tracking
- **material_achievements** - Material progress tracking
- **attendance_records** - Attendance tracking
- **evaluations** - Class evaluations

## Privilege Hierarchy

```
Admin (Kurikulum)
├── Assigns Dosen Privileges
│   ├── Dosen Pendamping
│   ├── Wali Kelas
│   ├── Pengurus Hafalan
│   ├── Pengurus Capaian Materi
│   └── Pengurus Kelas
└── Assigns Ketua Umum
    └── Ketua Umum can assign:
        ├── Ketua Kelompok
        ├── Kamtib
        ├── Ketua Fan Ilmu
        ├── Sekretaris
        └── Bendahara
```

## License

MIT
