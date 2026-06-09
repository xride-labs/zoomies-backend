export function phoneNumber() {
  return {};
}

export function bearer() {
  return {};
}

// config/auth.ts imports and calls emailOTP({...}) at module load. Without this
// export it resolves to undefined and throws "emailOTP is not a function",
// taking down every suite that imports the app.
export function emailOTP() {
  return {};
}
