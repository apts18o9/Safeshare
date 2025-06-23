
import SharePanel from "@/components/SharePanel";

export default function Home() {

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
