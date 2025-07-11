This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# Health Todo App

건강한 습관을 만들어가는 투두 앱입니다.

## 환경 설정

### 1. 환경 변수 설정

루트 디렉토리에 `.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. **Authentication** → **URL Configuration**에서 다음 설정:
   - Site URL: `https://your-app-name.vercel.app`
   - Additional Redirect URLs: 
     - `https://your-app-name.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`

### 3. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com)에서 프로젝트 생성
2. **APIs & Services** → **Credentials**에서 OAuth 2.0 클라이언트 ID 생성
3. 승인된 리디렉션 URI에 추가:
   - `https://your-project-ref.supabase.co/auth/v1/callback`
4. Supabase에서 Google OAuth 설정에 클라이언트 ID와 시크릿 추가

### 4. Vercel 배포 설정

Vercel 대시보드의 **Settings** → **Environment Variables**에서 동일한 환경 변수 설정

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
