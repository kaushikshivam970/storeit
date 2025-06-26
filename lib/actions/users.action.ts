"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { appwriteConfig } from "../appwrite/config";
import { parseStringify } from "../utils";
import { cookies } from "next/headers";
import { truncateSync } from "node:fs";
import { avatarPlaceholderUrl } from "@/constants";
import { redirect } from "next/navigation";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

const getUserByEmail = async (email: string) => {
  try {
    const { databases } = await createAdminClient();
    const result = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal("email", [email])]
    );
    return result.total > 0 ? result.documents[0] : null;
  } catch (error) {
    handleError(error, "Failed to get user by email");
  }
};

export const sendEmailOtp = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();
  try {
    const session = await account.createEmailToken(ID.unique(), email);
    return session.userId;
  } catch (error) {
    handleError(error, "Failed to send email OTP");
  }
};

export const createAccount = async ({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) => {
  try {
    const existingUser = await getUserByEmail(email);
    const accountId = await sendEmailOtp({ email });
    if (!accountId) throw new Error("Failed to send an OTP");
    if (!existingUser) {
      const { databases } = await createAdminClient();
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.usersCollectionId,
        ID.unique(),
        {
          fullName,
          email,
          avatar: avatarPlaceholderUrl,
          accountId,
        }
      );
    }
    return parseStringify({ accountId });
  } catch (error) {
    handleError(error, "Error Occurs while creating account.");
  }
};

export const verifySecret = async ({
  accountId,
  password,
}: {
  accountId: string;
  password: string;
}) => {
  try {
    const { account } = await createAdminClient();
    const session = await account.createSession(accountId, password);
    (await cookies()).set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });
    return parseStringify({ sessionId: session?.$id });
  } catch (error) {
    handleError(error, "Failed to verify OTP");
  }
};

// export const getCurrentUser = async () => {
//   const { databases, account } = await createSessionClient();
//   try {
//     const result = await account.get();
//     console.log("RESULT",result)
//     const user = await databases.listDocuments(
//       appwriteConfig?.databaseId,
//       appwriteConfig?.usersCollectionId,
//       [Query.equal("accountId", result.$id)]
//     );

//     if (user.total <= 0) return null;

//     return parseStringify(user.documents[0]);
//   } catch (error) {
//     console.log(error)
//     return null;
//   }
// };

export const getCurrentUser = async () => {
  const client = await createSessionClient();

  if (!client) return null;

  try {
    const result = await client.account.get();

    const user = await client.databases.listDocuments(
      appwriteConfig?.databaseId,
      appwriteConfig?.usersCollectionId,
      [Query.equal("accountId", result.$id)]
    );

    if (user.total <= 0) return null;

    return parseStringify(user.documents[0]);
  } catch (err) {
    console.warn("❌ Failed to fetch user from Appwrite:", err.message || err);
    return null;
  }
};


export const signOutUser = async () => {
  const { account } = await createSessionClient();
  try {
    await account.deleteSession("current");
    (await cookies()).delete("appwrite-session");
  } catch (error) {
    handleError(error, "Failed to sign out user");
  } finally {
    redirect("/sign-in");
  }
};

export const signInUser = async ({ email }: { email: string }) => {
  try {
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      await sendEmailOtp({ email });
      return parseStringify({ accountId: existingUser.accountId });
    } else {
      return parseStringify({ accountId: null, error: "User not found" });
    }
  } catch (error) {
    handleError(error, "Failed to sign in user");
  }
};
