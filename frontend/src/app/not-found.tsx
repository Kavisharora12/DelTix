import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[500px] w-full flex items-center justify-center p-6 bg-app select-none">
      <div className="max-w-md w-full bg-panel border border-slate-5 rounded-panel p-6 shadow-floating text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-3 border border-slate-5 text-slate-11 flex items-center justify-center mx-auto font-mono text-lg font-bold">
          404
        </div>
        <div className="space-y-1">
          <h2 className="text-title-page text-slate-12 font-semibold">
            Page Not Found
          </h2>
          <p className="text-ui text-slate-10">
            The requested operations console view does not exist.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="h-8 px-3 rounded-btn bg-slate-3 border border-slate-5 text-slate-12 text-ui font-medium inline-flex items-center gap-1.5 hover:bg-slate-4 transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>Go Home</span>
          </Link>
          <Link
            href="/runs"
            className="h-8 px-3 rounded-btn bg-white text-black font-semibold text-ui inline-flex items-center gap-1.5 hover:bg-neutral-200 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Go to Runs</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

