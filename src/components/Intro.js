const Intro = ({ setActiveSection }) => {
  return (
    <div className="intro-nav">
      <h1 className='myName'>Derrick Hua</h1>
      <p className='myTitle'>Full Stack Software Developer</p>
      <nav>
        <ul>
          <li onClick={() => setActiveSection('about')}>About</li>
          <li onClick={() => setActiveSection('skills')}>Skills</li>
          <li onClick={() => setActiveSection('projects')}>Projects</li>
          <li onClick={() => setActiveSection('contact')}>Contact</li>
        </ul>
      </nav>
    </div>
  );
};

export default Intro;