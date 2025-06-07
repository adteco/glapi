export default function PageIllustration() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px]">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 blur-3xl" />
      </div>
      <div className="absolute bottom-0 right-1/2 translate-x-1/2 translate-y-1/2 w-[800px] h-[800px]">
        <div className="absolute inset-0 bg-gradient-to-l from-blue-600/20 to-purple-600/20 blur-3xl" />
      </div>
    </div>
  );
}