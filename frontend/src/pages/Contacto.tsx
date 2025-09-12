function Contacto() {
  const email = 'lccastrop@unal.edu.co';
  const whatsappUrl = 'https://wa.me/52552000248';
  const instagramUrl = 'https://instagram.com/Camilo92c';
  const tiktokUrl = 'https://www.tiktok.com/@Camilo92c';

  return (
    <div className="contenedor-secundario">
      <h2>Contacto</h2>
      <p>
        <strong>Email:</strong>{' '}
        <a href={`mailto:${email}`}>
          {email}
        </a>
      </p>
      <p>
        <strong>WhatsApp:</strong>{' '}
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          Enviar mensaje
        </a>
      </p>
      <div>
        <strong>Redes sociales:</strong>
        <ul>
          <li>
            Instagram:{' '}
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
              @Camilo92c
            </a>
          </li>
          <li>
            TikTok:{' '}
            <a href={tiktokUrl} target="_blank" rel="noopener noreferrer">
              @Camilo92c
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default Contacto;

