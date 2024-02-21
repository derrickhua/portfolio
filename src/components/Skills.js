// About.js
import React from 'react';

const Skills = () => {
  const skills = {
    Languages: ['JavaScript', 'TypeScript', 'Python', 'HTML/CSS', 'SQL', 'C'],
    Tools: ['MongoDB', 'PostgreSQL', 'S3', 'Heroku', 'Node.js', 'Firebase', 'Docker', 'Expo', '.NET Core', 'SQLite'],
    Frameworks: ['React', 'Next.js', 'Three.js', 'Django', 'Flask', 'Fastify', 'Bootstrap', 'Express', 'React-Native', 'Tailwind CSS']
  };

  const experiences = [
    {
      role: 'Full Stack Web Developer',
      company: 'SiteGenie AI',
      duration: 'October 2023 - Present',
      description: 'Revolutionizing the construction industry through AI.',
    },
    {
      role: 'Founding Engineer',
      company: 'Bloom',
      duration: 'August 2023 - Present',
      description: 'Addressing the mental health crisis with tech solutions.',
    }
  ];

  return (
    <div className='mySkills'>
      <h2>Skills</h2>
      <div className="skills-container">
        {Object.entries(skills).map(([category, skillsList]) => (
          <div key={category} className="category-container">
            <p className="category-title">{category}:</p>
            <div className="skill-list">
              {skillsList.map(skill => (
                <p className="skill-item" key={skill}>{skill}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <h2>Experience</h2>
      {experiences.map(exp => (
        <div key={exp.company} className="experience-item">
          <div className="experience-header">
            <p className='experience-title'>{exp.role} - {exp.company}</p>
            <p className="experience-duration">{exp.duration}</p>
          </div>
          <p className="experience-description">{exp.description}</p>
        </div>
      ))}
    </div>
  );
};


export default Skills;