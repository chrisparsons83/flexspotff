import React from "react";

const NavBar = () => {
  return (
    <div className="dark:bg-gray-900">
      <div className="container mx-auto flex flex-wrap items-center justify-between px-4 py-3 text-gray-200 shadow-lg">
        <div className="font-bold">
          <a href="/">FlexSpotFF</a>
        </div>
        <nav className="flex gap-2">
          <a href="/">Home</a>
          <a href="/leagues">Leagues</a>
          <a href="/podcast">Podcast</a>
          <a href="/account">My Account</a>
        </nav>
      </div>
    </div>
  );
};

export default NavBar;
