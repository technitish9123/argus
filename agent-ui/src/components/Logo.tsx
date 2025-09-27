import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function Logo() {
  const [showGeek, setShowGeek] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setShowGeek((prev) => !prev), 3000);
    return () => clearInterval(interval);
  }, []);

  // Variants for "geeky" typography
  const geekVariants = [
    "ΛRGUS",  // Greek Lambda style
    "ⱯЯGUS",  // mirrored letters
    "𝔄ℜ𝔊𝔘𝔖", // gothic / blackletter
    "ARGƱS",  // unicode u
  ];

  return (
    <Link
      to="/"
      className="text-2xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent transition-all duration-700 font-geek"
    >
      {showGeek ? geekVariants[Math.floor(Math.random() * geekVariants.length)] : "ARGUS"}
    </Link>
  );
}

export default Logo;
