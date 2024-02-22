import logo from './logo.svg';
import './App.css';
import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import Intro from './components/Intro';
import About from './components/About';
import Projects from './components/Projects';
import Contact from './components/Contact';
import Skills from './components/Skills';
import WaterSimulation from './WaterPlane';


function App() {
  const [activeSection, setActiveSection] = useState('about'); // Default section

  const renderSection = () => {
    switch (activeSection) {
      case 'about':
        return <About />;
      case 'skills':
        return <Skills />;
      case 'projects':
        return <Projects />;
      case 'contact':
        return <Contact />;
      default:
        return <About />;
    }
  };

  return (
<div className="App">
  {/* <div className='underlay'> */}
  <WaterSimulation />
  {/* </div> */}
  <div className='container'>
  <Intro setActiveSection={setActiveSection} />
  <div className="content-section">
      {renderSection()}
  </div>
  </div>
</div>
  );
}

export default App;
