import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const COOKIE_NAME = "mamal_session";

// User type enum values from Prisma
type PrismaUserType = "ADMIN" | "DOSEN" | "MAHASISWA";
type SessionUserType = "admin" | "dosen" | "mahasiswa";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  userType: SessionUserType;
  photoUrl: string | null;
}

export interface Session {
  user: SessionUser;
}

// Helper to convert Prisma UserType enum to lowercase string
function userTypeToString(userType: PrismaUserType): SessionUserType {
  const mapping: Record<PrismaUserType, SessionUserType> = {
    ADMIN: "admin",
    DOSEN: "dosen",
    MAHASISWA: "mahasiswa",
  };
  return mapping[userType];
}

// Helper to convert lowercase string to Prisma UserType enum
export function stringToUserType(str: string): PrismaUserType {
  const mapping: Record<string, PrismaUserType> = {
    admin: "ADMIN",
    dosen: "DOSEN",
    mahasiswa: "MAHASISWA",
  };
  return mapping[str.toLowerCase()] || "MAHASISWA";
}

export async function createSession(user: SessionUser): Promise<string> {
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      photoUrl: user.photoUrl,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return token;
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionUser;

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: userTypeToString(user.userType as PrismaUserType),
        photoUrl: user.photoUrl,
      },
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireRole(
  allowedRoles: SessionUserType[]
): Promise<Session> {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.user.userType)) {
    throw new Error("Forbidden");
  }
  return session;
}
