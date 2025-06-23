// components/header.tsx
import React from 'react';
import Image from 'next/image';
const Header: React.FC = () => {
  return (
     <header className="bg-[#404756] text-white p-4">
      <div className="container mx-auto flex items-center mt-4 ml-4 ">
    
        <div className="flex items-center">
          <Image
            src="/share.png"
            alt="share"
            width={40}
            height={40}
          />
      
          <h1 className="text-4xl font-bold ml-2 ">Safeshare</h1>
        </div>
      </div>
      <hr className="my-6 border-t-1 border-gray-300" />
    </header>
    
    
  );
};

export default Header;