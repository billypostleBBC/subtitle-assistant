import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Enables `next dev` to emulate the Cloudflare runtime used by Webflow Cloud.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
