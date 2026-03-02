import { betterAuth } from "better-auth";

const defaultAuth = betterAuth({
  database: {
    provider: "sqlite",
    url: ":memory:",
  },
  emailAndPassword: { enabled: true },
});

console.log(Object.keys(defaultAuth.api));
