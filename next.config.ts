import type { NextConfig } from "next";
// @ts-expect-error — next-pwa lacks ESM types
import withPWA from "next-pwa";

const config: NextConfig = {
  turbopack: {},
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})(config);
