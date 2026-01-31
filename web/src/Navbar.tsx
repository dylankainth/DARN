import React from 'react';
import './Navbar.css';

const Navbar = () => {
  return (

<nav className="navbar">
  <div className="navbar-left">
    <a href="/" className="logo">
      DARN
    </a>
  </div>
  <div className="navbar-center">
    <ul className="nav-links">
      <li>
        <a href="/tbc">tbc</a>
      </li>
    </ul>
  </div>
</nav>
);
};

export default Navbar;