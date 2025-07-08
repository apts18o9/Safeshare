'use client'
import SharePanel from "@/components/SharePanel";
import { useEffect } from "react";
export default function Home() {


  useEffect(() => {
    console.log('[Home/page.tsx] Component Mounted');
    return () => {
      console.log('[Home/page.tsx] Component Unmounted');
    };
  }, []);

  console.log('[Home/page.tsx] Component Rendered');

  return (
    <div>
      <div className='text-4xl ml-13'>
        <h2 className='text-white'>
          Share files at ease.
        </h2>
        <br></br>
        <h2 className='text-amber-300'>
          Send. View. Use.
        </h2>
      </div>

      <SharePanel />
    </div>

  );
}
