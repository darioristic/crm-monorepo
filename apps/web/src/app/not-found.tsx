import { ArrowLeft, FileQuestion, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md border-none shadow-none bg-transparent">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle className="text-4xl font-bold tracking-tight">404</CardTitle>
          <CardDescription className="text-lg mt-2">Page not found</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground text-balance">
            The page you&apos;re looking for doesn&apos;t exist or has been moved. Check the URL or
            navigate back to safety.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-4">
          <Button asChild size="lg" className="w-full">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="w-full">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to dashboard
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
