import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { fieldErrors, loginSchema, normalizePhone, registerSchema } from "./validation";

describe("passwords", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse 9");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse 9", hash)).toBe(true);
    expect(await verifyPassword("correct horse 8", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same-password-1")).not.toBe(await hashPassword("same-password-1"));
  });

  it("rejects a malformed stored value", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});

describe("normalizePhone", () => {
  it.each([
    ["+994 50 123 45 67", "+994501234567"],
    ["050-123-45-67", "+994501234567"],
    ["00994501234567", "+994501234567"],
    ["+1 (415) 555-0100", "+14155550100"],
  ])("%s -> %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it("treats empty as not provided and garbage as invalid", () => {
    expect(normalizePhone("  ")).toBeNull();
    expect(normalizePhone("12345")).toBe("");
    expect(normalizePhone("call me")).toBe("");
  });
});

const valid = {
  fullName: "Aysel Məmmədova",
  email: "  Aysel@Example.com ",
  password: "gizli-parol-7",
  confirmPassword: "gizli-parol-7",
  phone: "",
  acceptTerms: "on",
};

describe("registerSchema", () => {
  it("accepts a valid form, lower-cases the email and keeps phone optional", () => {
    const result = registerSchema.parse(valid);
    expect(result).toMatchObject({ email: "aysel@example.com", phone: null, dealAlerts: false });
  });

  it("reports each problem against its field", () => {
    const result = registerSchema.safeParse({
      ...valid,
      fullName: " ",
      email: "not-an-email",
      password: "short",
      confirmPassword: "different",
      phone: "123",
      acceptTerms: undefined,
    });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!)).toEqual({
      fullName: "nameRequired",
      email: "emailInvalid",
      password: "passwordShort",
      phone: "phoneInvalid",
      acceptTerms: "termsRequired",
    });
  });

  it("requires a letter and a digit, and matching passwords", () => {
    expect(fieldErrors(registerSchema.safeParse({ ...valid, password: "12345678", confirmPassword: "12345678" }).error!)).toEqual({
      password: "passwordWeak",
    });
    expect(fieldErrors(registerSchema.safeParse({ ...valid, confirmPassword: "gizli-parol-8" }).error!)).toEqual({
      confirmPassword: "passwordMismatch",
    });
  });
});

describe("loginSchema", () => {
  it("normalises the email", () => {
    expect(loginSchema.parse({ email: "A@B.az", password: "x" }).email).toBe("a@b.az");
  });
});
