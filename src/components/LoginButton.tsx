export default function LoginButton() {
  return (
    <a
      href="/api/auth/login"
      className="inline-flex rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
    >
      Login with SecondMe
    </a>
  );
}
