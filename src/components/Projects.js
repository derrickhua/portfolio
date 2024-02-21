import React from 'react';

const Projects = () => {
  const projectList = [
    {
      title: 'ta-o',
      url: 'https://ta-o.herokuapp.com', // Add your real project link
      stack: 'MongoDB, Express, React, Node.js, JavaScript',
      duration: 'May - June 2023',
      summary: 'A marketplace for educational exchange, empowering learning through a simple user interface.',
    },
    {
      title: 'Fridgify',
      url: 'https://fridgify-ae07ed975bfa.herokuapp.com', // Your project's live link
      stack: 'JavaScript, MongoDB, Express, React, Node.js, Twilio, Three.js',
      duration: 'July - October 2023',
      summary: 'A food management solution to minimize waste and automate tracking ingredient freshness.',
    },
    {
      title: 'Muto',
      url: 'https://github.com/derrickhua/Muto', // Your project's documentation or live version
      stack: 'Python, OCR, Computer Vision, Next.js, Tailwind, Docker',
      duration: 'December 2023 - Present',
      summary: 'A manga translation assistant, simplifying the localisation of material through AI-driven OCR.',
    },
  ];

  return (
    <div className="projects-container">
      <h2>Projects</h2>
      <div className="projects-list">
        {projectList.map((project) => (
          <article key={project.title} className="project">
            <div className='project-first'>
                <a href={project.url} className="project-title">{project.title}</a>
                <p>{project.duration}</p>
            </div>
            <p className="project-stack">
              <small>{project.stack}</small>
            </p>
            <p className="project-summary">{project.summary}</p>
          </article>
        ))}
      </div>
    </div>
  );
};

export default Projects;