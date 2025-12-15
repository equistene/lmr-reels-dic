declare module "next-pwa" {
  import type { NextConfig } from "next";
  type PWAOptions = {
    dest?: string;
    disable?: boolean;
  };
  const withPWA: (opts?: PWAOptions) => (config: NextConfig) => NextConfig;
  export default withPWA;
}
