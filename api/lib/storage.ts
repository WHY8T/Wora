import { env } from "./env";

/**
 * Uploads an image to the "avatars" bucket in Supabase Storage and returns
 * its public URL. Bucket must be created and set to public in the Supabase
 * dashboard (Storage → New bucket → "avatars" → Public bucket ON).
 */
export async function uploadAvatarImage(
    userId: number,
    bytes: Buffer,
    contentType: string,
): Promise<string> {
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
        throw new Error(
            "Photo uploads aren't configured yet — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env.",
        );
    }

    const ext = contentType === "image/png" ? "png" : "jpg";
    const path = `user-${userId}-${Date.now()}.${ext}`;

    const res = await fetch(
        `${env.supabaseUrl}/storage/v1/object/avatars/${path}`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
                apikey: env.supabaseServiceRoleKey,
                "Content-Type": contentType,
                "x-upsert": "true",
            },
            body: bytes as any,
        },
    );

    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Upload failed (${res.status}): ${detail.slice(0, 200)}`);
    }

    return `${env.supabaseUrl}/storage/v1/object/public/avatars/${path}`;
}