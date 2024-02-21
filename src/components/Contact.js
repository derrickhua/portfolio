import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLinkedin, faGithub, faInstagram } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';

const Contact = () => {
  return (
    <div className="contact-container">
      <h2 className="contact-title">Looking to collaborate or just want to talk tech or anything else under the sun</h2>
      <h2 className="contact-title">You can find me here</h2>

      <ul className="social-links">
        <li>
          <a href="https://www.linkedin.com/in/derrick-paul-zamora-hua/" target="_blank" rel="noopener noreferrer">
            <FontAwesomeIcon icon={faLinkedin} /> 
          </a>
        </li>
        <li>
          <a href="https://github.com/derrickhua" target="_blank" rel="noopener noreferrer">
            <FontAwesomeIcon icon={faGithub} /> 
          </a>
        </li>
        <li>
          <a href="https://www.instagram.com/der_._._rick/" target="_blank" rel="noopener noreferrer">
            <FontAwesomeIcon icon={faInstagram} /> 
          </a>
        </li>
        <li>
          <a href="mailto:derrickhua6@gmail.com">
            <FontAwesomeIcon icon={faEnvelope} /> 
          </a>
        </li>
      </ul>
    </div>
  );
};

export default Contact;