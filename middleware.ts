const USERNAME = process.env.BASIC_AUTH_USERNAME;
const PASSWORD = process.env.BASIC_AUTH_PASSWORD;

export default function middleware(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Basic ")) {
    return unauthorized();
  }

  const encodedCredentials = authorization.slice("Basic ".length);

  let decodedCredentials: string;

  try {
    decodedCredentials = atob(encodedCredentials);
  } catch {
    return unauthorized();
  }

  const separatorIndex = decodedCredentials.indexOf(":");

  if (separatorIndex === -1) {
    return unauthorized();
  }

  const username = decodedCredentials.slice(0, separatorIndex);
  const password = decodedCredentials.slice(separatorIndex + 1);

  if (username !== USERNAME || password !== PASSWORD) {
    return unauthorized();
  }

  return;
}

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Private Website"',
      "Cache-Control": "no-store",
    },
  });
}
