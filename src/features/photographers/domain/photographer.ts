import { z } from "zod";

export const socialPlatforms = ["instagram", "facebook", "tiktok", "youtube", "threads"] as const;

export type SocialPlatform = (typeof socialPlatforms)[number];

export const socialPlatformLabels: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  threads: "Threads",
};

export const socialLinkSchema = z.object({
  platform: z.enum(socialPlatforms),
  value: z.string().trim().min(1).max(200),
});

export type SocialLink = z.infer<typeof socialLinkSchema>;

export function socialLinkUrl(link: SocialLink): string {
  const handle = link.value.replace(/^@/, "");
  if (/^https?:\/\//i.test(link.value)) return link.value;
  switch (link.platform) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "facebook":
      return `https://facebook.com/${handle}`;
    case "tiktok":
      return `https://tiktok.com/@${handle}`;
    case "youtube":
      return `https://youtube.com/${handle}`;
    case "threads":
      return `https://threads.net/@${handle}`;
    default:
      return link.value;
  }
}

export const photographerSignupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().min(10).max(160),
  bio: z.string().trim().min(20).max(2000),
  locationLabel: z.string().trim().max(120).optional().default(""),
  socials: z.array(socialLinkSchema).min(1).max(5),
  email: z.email().max(320),
  website: z.string().max(0).optional().default(""),
});

export type PhotographerSignupInput = z.infer<typeof photographerSignupSchema>;

export const photographerReviewSchema = z.object({
  photographerId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(800),
  reviewerName: z.string().trim().max(80).optional().default(""),
  reviewerEmail: z.union([z.literal(""), z.email().max(320)]).optional().default(""),
  website: z.string().max(0).optional().default(""),
});

export type PhotographerReviewInput = z.infer<typeof photographerReviewSchema>;

export type PublicPhotographer = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  bio: string;
  locationLabel: string | null;
  socials: SocialLink[];
  coverImageUrl: string | null;
  photoUrls: string[];
  averageRating: number | null;
  reviewCount: number;
};

export type PublicPhotographerReview = {
  id: string;
  rating: number;
  comment: string;
  reviewerName: string | null;
  createdAt: string;
};
