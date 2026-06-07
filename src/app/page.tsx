// Root page — middleware handles all routing.
// This component only renders briefly before middleware redirects.
// Unauthenticated users → /login
// Cell leaders → /cell
// Overseer → /dashboard

export default function RootPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-2xl font-semibold text-shepherd-800 mb-2">
          SHEP.HERD
        </div>
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    </div>
  );
}
