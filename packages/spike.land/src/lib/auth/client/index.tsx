"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import type { Session } from "@/lib/auth/types";
import type { ReactNode } from "react";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "",
    plugins: [
        magicLinkClient()
    ]
});

const originalUseSession = authClient.useSession;

// Maps better-auth useSession to next-auth/react useSession signature
export function useSession() {
    const { data, isPending } = originalUseSession();

    let status: "loading" | "authenticated" | "unauthenticated" = "loading";
    let nextAuthSession: Session | null = null;

    if (isPending) {
        status = "loading";
    } else if (data?.session && data?.user) {
        status = "authenticated";
        nextAuthSession = {
            user: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.name,
                image: data.user.image,
                role: (data.user as any).role || "USER",
            }
        };
    } else {
        status = "unauthenticated";
    }

    return {
        data: nextAuthSession,
        status
    };
}

export const signIn = async (provider: string, options?: any) => {
    if (provider === "google") {
        return authClient.signIn.social({ provider: "google", ...options });
    }
    if (provider === "github") {
        return authClient.signIn.social({ provider: "github", ...options });
    }
    if (provider === "email" || provider === "credentials") {
        // Need to handle custom email auth logic if it exists
        // better-auth has `signIn.email` 
        if (options?.email && !options?.password) {
            return authClient.signIn.magicLink({ email: options.email, ...options });
        }
        return authClient.signIn.email({ email: options.email, password: options.password, ...options });
    }
    if (provider === "qr-auth") {
        return authClient.$fetch("/sign-in/qr", {
            method: "POST",
            body: {
                qrHash: options.qrHash,
                qrOneTimeCode: options.qrOneTimeCode
            }
        });
    }
    return Promise.reject(new Error("Unknown provider"));
};

export const signOut = async (options?: any) => {
    return authClient.signOut(options);
};

export function SessionProvider({ children }: { children: ReactNode, session?: Session | null }) {
    return <>{children} </>;
}
