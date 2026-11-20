import "server-only";

export const isAuthMock = process.env.AUTH_USE_MOCK !== "false";
