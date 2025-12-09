import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-red-600">403</h1>
        <h2 className="text-2xl font-semibold">Unauthorized Access</h2>
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
        <div className="pt-4">
          <Link
            href="/"
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
