const { client, xml, jid } = require("@xmpp/client")
const fs = require('fs')
const path = require('path')
const net = require('net')
const debug = require("@xmpp/debug")
const readline = require('readline')
const contacts = {}
const groupRoster = {}
const regiState = {successfulRegistration: false } 
let base64Data = ''

// Interfaz para leer la entrada del usuario
const lectorLinea = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})
// Menu principal para CREAR/INICIAR/ELIMINAR usuario
function menu() {
    console.log("\n=================================== Bienvenido al AlumChat ===================================\n");
    console.log("Por favor, seleccione una opción:\n");
    console.log("[1] Registrar una cuenta nueva en el servidor");
    console.log("[2] Iniciar sesión con una cuenta existente");
    console.log("[3] Eliminar la cuenta del servidor");
    console.log("[4] Salir del programa");
    lectorLinea.question("\nIngrese el número de la opción que desea ejecutar: ", (answer) => {
      manejoOp(answer);
    });
}
// Funcion para limpiar el roster al cerrar sesion
const limpContac = (contacts) => {
  for (const contact in contacts) {
    if (contacts.hasOwnProperty(contact)) {
      delete contacts[contact];
    }
  }
};
// Funcion para obtener el roster (lista de contactos) del usuario
const obtLista = (xmpp, jid) => {
  const rosterQuery = {
    iq: {
      attrs: {
        type: 'get',
        to: `${jid}@alumchat.xyz`
      },
      children: [
        {
          query: {
            attrs: {
              xmlns: 'jabber:iq:roster'
            }}}]}};
  xmpp.send(xml(rosterQuery));
};

// Funcion para dar formato a los contactos al mostralectorLineaos en el CLI
const contacForm = async () => {
  if (contacts.length === 0) {
    console.log('No tienes contactos');
  } else {
    console.log('Contactos:');
    console.log('JID\tstatus\tstatus');
    
    for (const contact in contacts) {
      const isGroup = contact.includes('@conference.alumchat.xyz');
      const contactJid = contact.split('@')[0];
      let statusLine;
      
      if (isGroup) {
        // Obtener el roster del grupo y mostrarlo
        const groupRoster = contacts[contact];
        statusLine = `=> ${contactJid}: ${Object.keys(groupRoster).length} miembros`;
        
        if (groupRoster) {
          for (const member in groupRoster) {
            const memberJid = member.split('@')[0];
            const memberStatus = groupRoster[member].status;
            const memberMessage = groupRoster[member].showMessage || 'sin status';
            console.log(`\t--> ${memberJid}: ${memberStatus} \t(${memberMessage})`);
          }
        }
      } else {
        // Imprimir sin tabulación
        const padding = contactJid.length < 7 ? '\t\t' : '\t';
        statusLine = `=> ${contactJid}:${padding}${contacts[contact].status} \t(${contacts[contact].showMessage || 'sin status'})`;
      }
      console.log(statusLine);
    }
  }
};

// Funcion para cambiar el status y status del usuario
const cambioEst = (xmpp, status, showMessage) => {
  const successMessage = `\x1b[32m ¡Status cambiado EXITOSAMENTE a \x1b[0m ${status} \x1b[32m con showMessage \x1b[0m ${showMessage}`;
  const errorMessage = `\x1b[31m [ERROR] El status no pudo ser cambiado (intente de nuevo):`;

  try {
    const presenceStanza = {
      presence: {
        children: [
          {
            status: {
              _text: status,
            },
          },
          {
            showMessage: {
              _text: showMessage,
            },
          },
        ],
      },
    };

    xmpp.send(xml(presenceStanza));
    console.log(successMessage);
  } catch (error) {
    console.error(`${errorMessage} ${error.message}`);
  }
};

// Funcion para leer el archivo y envialectorLineao
const leerArchivo = async (xmpp, path, toJid) => {
  try {
    const extension = path.split('.').pop();
    const fileData = await fs.promises.readFile(path);
    const encodedFileData = Buffer.from(fileData).toString('base64');
    const message = `file://${extension}://${encodedFileData}`; // Se crea el mensaje

    mandMensa(xmpp, toJid, message);
    console.log(`El archivo ${path} se ha adjuntado correctamente.`);
  } catch (error) {
    console.error('[ERROR] El archivo adjuntado no existe. Por favor, verifique que el input sea correcto.');
  }
};

// Funcion para manejar las opciones del menu principal de acciones
function manejoOp(option) {
  const promptForCredentials = (callback) => {
    lectorLinea.question('Porfavor, coloque el ID para la cuenta: ', (jid) => {
      lectorLinea.question('Porfavor, coloque la contraseña para la cuenta: ', (password) => {
        callback(jid, password);
      });
    });
  };

  switch (option) {
    case '1':
      promptForCredentials(regi);
      break;
    case '2':
      promptForCredentials(login);
      break;
    case '3':
      promptForCredentials(elimincarCuent);
      break;
    case '4':
      console.log('Saliendo del programa...');
      lectorLinea.close();
      process.exit(0);
    default:
      console.log('Opción no válida. Por favor, elige una opción válida.');
      menu();
  }
}

//  Muestra el color identificador para lo statuss de los Usuarios
const statusColor = {
    'away': '\x1b[35mAway\x1b[0m', // Morado
    'exa': '\x1b[33mExtended away\x1b[0m', // Amarillo
    'dnd': '\x1b[31mDo not disturb\x1b[0m', // Rojo
    'ava': '\x1b[32mAvailable\x1b[0m', // Verde
    'unavailable': '\x1b[37mOffline\x1b[0m', // Blanco
}
// Funcion para registrar una nueva cuenta
async function regi(username, password) {
  const xmppServer = 'alumchat.xyz';
  const xmppPort = 5222;

  const client = new net.Socket();

  client.connect(xmppPort, xmppServer, () => {
    console.log('Connected');
    const streamOpening = '<stream:stream to="' + xmppServer + '" xmlns="jabber:client" xmlns:stream="http://etherx.jabber.org/streams" version="1.0">';
    client.write(streamOpening);
  });

  client.on('data', (data) => {
    console.log('Received: ' + data);

    if (data.toString().includes('<stream:features>')) {
      const registrationQuery = `<iq type="set" id="reg1"><query xmlns="jabber:iq:regi"><username>${username}</username><password>${password}</password></query></iq>`;
      client.write(registrationQuery);
    } else if (data.toString().includes('iq type="result" id="reg1"')) {
      console.log('Registro exitoso, iniciando sesión...\n\n');
      client.destroy();
      login(username, password);
    } else if (data.toString().includes('<error code"409" type="cancel"><conflict xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>')) {
      console.log('[ERROR] El usuario ya existe, por favor elige un nombre de usuario diferente.');
      client.destroy();
      menu();
    }
  });

  client.on('close', () => {
    console.log('Connection closed');
    if (!regiState.successfulRegistration) {
      menu();
    }
  });
}

// Funcion para crear una sala de chat
const crearRoom = async (xmpp, roomName) => {
  try {
    const groupJid = `${roomName}@conference.alumchat.xyz/${xmpp.jid.local}`;
    
    // Crear sala de chat
    const createRoomStanza = xml('presence', { to: groupJid }, xml('x', { xmlns: 'http://jabber.org/protocol/muc' }));
    xmpp.send(createRoomStanza);
    
    // Configurar sala de chat como abierta
    const configRequest = xml('iq', { to: groupJid, type: 'set' }, 
      xml('query', { xmlns: 'http://jabber.org/protocol/muc#owner' }, 
        xml('x', { xmlns: 'jabber:x:data', type: 'submit' }, 
          xml('field', { var: 'muc#roomconfig_publicroom', type: 'boolean' }, 
            xml('value', {}, '1')
          )
        )
      )
    );
    xmpp.send(configRequest);

    console.log("[EXITO] Sala de chat creada exitosamente y configurada como abierta");
  } catch (error) {
    console.log(`[ERROR] Error al crear la sala de chat: ${error.message}`);
  }
};

// Funcion para unirse a una sala de chat
const unirseRoom = async (xmpp, roomName) => {
  try {
    const groupJid = `${roomName}@conference.alumchat.xyz/${xmpp.jid.local}`;
    
    // Enviar presencia para unirse al grupo
    const joinGroupStanza = xml('presence', { to: groupJid }, xml('x', { xmlns: 'http://jabber.org/protocol/muc' }));
    xmpp.send(joinGroupStanza);
    
    console.log(`[EXITO] Intentando unirse al grupo público ${roomName}`);
  } catch (error) {
    console.log(`[ERROR] Error al unirse a la sala de chat: ${error.message}`);
  }
};

// Funcion para agregar un contacto con una stanza de presence
const agreCon = async (xmpp, contactJid) => {
  try {
    const presenceStanza = xml('presence', { to: `${contactJid}@alumchat.xyz`, type: 'subscribe' });
    await xmpp.send(presenceStanza);
    console.log('Solicitud de contacto enviada a', contactJid);
  } catch (error) {
    console.log('[ERROR] Error al agregar contacto', error);
  }
};

// Funcion para enviar mensajes
const mandMensa = async (xmpp, contactJid, message) => {
  try {
    const messageStanza = xml(
      'message',
      { type: 'chat', to: `${contactJid}@alumchat.xyz` },
      xml('body', {}, message)
    );
    await xmpp.send(messageStanza);
  } catch (error) {
    console.log('[ERROR] Error al enviar mensaje', error);
  }
};

async function login(jid, password) {
  // Nos conectamos al servidor
  const xmpp = client({
    service: 'xmpp://alumchat.xyz:5222',
    domain: 'alumchat.xyz',
    username: jid, 
    password: password,
  })
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  // Funcion para mostrar el segundo menu de funciones- GENERADO CON AYUDA DE CHATGPT
  const secondMenu = ()=> {
    console.log('\n')
    console.log('[1] Mostrar todos los contactos y su status')
    console.log('[2] Agregar un usuario a los contactos')
    console.log('[3] Mostrar detalles de contacto de un usuario')
    console.log('[4] Comunicación 1 a 1 con cualquier usuario/contacto')
    console.log('[5] Participar en conversaciones grupales')
    console.log('[6] Cambiar status y status')
    console.log('[7] Enviar/recibir archivos')
    console.log('[8] Cerrar sesion')
    lectorLinea.question('\nElige una opción: ',async (answer) => {
      await manejoSecuOptMenu(answer)
    })
  }
  // Funcion para mostrar el menu de funciones de grupo
  const handleGroup = (option) => { 
    switch (option) {
      case '1':
        // Crear grupo
        lectorLinea.question('Porfavor, coloque el nombre del grupo: ', (groupName) => {
          crearRoom(xmpp,groupName)
          secondMenu()
        })
        break
      case '2':
        // Enviar mensaje a grupo
        lectorLinea.question('Porfavor, coloque el nombre del grupo: ', (groupName) => {
          lectorLinea.question('Porfavor, coloque el mensaje que deseas enviar: ', (message) => {
            const groupJid = `${groupName}@conference.alumchat.xyz`
            const messageStanza = xml('message', { to: groupJid, type: 'groupchat' }, xml('body', {}, message))
            xmpp.send(messageStanza)
            secondMenu()
          })
        })
        break
      case '3':
        // Agregar usuario a grupo
        lectorLinea.question('Porfavor, coloque el nombre del grupo: ', (groupName) => {
          lectorLinea.question('Porfavor, coloque el JID del usuario que deseas agregar: ', (contactJid) => {
            const groupJid = `${groupName}@conference.alumchat.xyz`
            const inviteStanza = xml('message', { to: groupJid },
              xml('x', { xmlns: 'http://jabber.org/protocol/muc#user' },
                xml('invite', { to: `${contactJid}@alumchat.xyz` })
              )
            )
            xmpp.send(inviteStanza)
            console.log(`Invitación enviada a ${contactJid} para unirse al grupo ${groupName}`)
            secondMenu()
          })
        })
        break
      case '4':
        // Unirse a un grupo público
        lectorLinea.question('Porfavor, coloque el nombre del grupo público al que deseas unirte: ', (groupName) => {
          unirseRoom(xmpp,groupName)
          secondMenu()
        })
        break
      default:
        console.log('[ERROR] Opción no válida. Por favor, elige una opción válida.')
        secondMenu()
    }
  }
  // Funcion para manejar las opciones del menu de funciones
  const manejoSecuOptMenu = async(option) => {
    switch (option) {
      case '1':
        //Mostar todos los contactos y su status
        contacForm()
        secondMenu()
        break
      case '2':
        // Agregar un usuario a los contactos
        lectorLinea.question('Porfavor, coloque el ID del usuario que deseas agregar: ',async (contactJid) => {
          agreCon(xmpp, contactJid)
          secondMenu()
        })
        break
      case '3':
        // Mostrar detalles de contacto de un usuario
        lectorLinea.question('Porfavor, coloque el JID del usuario del que deseas ver detalles: ', (contactJid) => {
          const contact = contacts[contactJid + '@alumchat.xyz']
          if (contact) {
            console.log(`Detalles de ${contactJid}: ${contact.status || 'disponible'} (${contact.showMessage || 'sin status'})`)
          } else {
            console.log('No se encontró el usuario o no está en tu lista de contactos.')
          }
          secondMenu()
        })
        break
      case '4':
        // Comunicación 1 a 1 con cualquier usuario/contacto
        lectorLinea.question('Porfavor, coloque el JID del usuario con el que deseas chatear: ', (contactJid) => {
          lectorLinea.question('Porfavor, coloque el mensaje que deseas enviar: ', (message) => {
            mandMensa(xmpp, contactJid, message)
            secondMenu()
          })
        })
        break
      case '5':
        // Participar en conversaciones grupales
        console.log('1) Crear grupo')
        console.log('2) Enviar mensaje a grupo')
        console.log('3) Agregar usuario a grupo')
        console.log('4) Unirse a un grupo público') // Nueva opción aquí
        lectorLinea.question('\nElige una opción: ', (answer) => {
          handleGroup(answer)
        })
        break
      case '6':
        // Cambiar status y status
        for (const status in statusColor) {
          console.log(`${status}: ${statusColor[status]}`)
        }
        lectorLinea.question('\n Porfavor, coloque el status que deseas usar: ', (status) => {
          lectorLinea.question(' \n Porfavor, coloque el mensaje de status que deseas usar (opcional): ', (showMessage) => {
            cambioEst(xmpp, status, showMessage)
            secondMenu()
          })
        })
        break
      case '7':
        // Enviar/recibir archivos
        lectorLinea.question('\n Porfavor, coloque el JID del usuario al que deseas enviar un archivo: ', (contactJid) => {
          lectorLinea.question('\n Porfavor, coloque la ruta del archivo que deseas enviar: ', async (filePath) => {
            await leerArchivo(xmpp,filePath,contactJid)
            secondMenu()
          })
        })
        break
      case '8':
        // Cerrar sesion
        await xmpp.send(xml('presence', {type: 'unavailable'}))
        await xmpp.stop()
        limpContac
        break
      default:
        console.log('[ERROR] Opción no válida. Por favor, elige una opción válida.')
        secondMenu()
    }
  }
  xmpp.on('stanza', async (stanza) => {
    if (stanza.is('message')) {
      
      // Manejar invitaciones a salas de grupo
      if (stanza.is('message') && stanza.getChild('x', 'http://jabber.org/protocol/muc#user') 
          && stanza.getChild('x', 'http://jabber.org/protocol/muc#user').getChild('invite')) 
      {
        const roomJid = stanza.attrs.from
        console.log(`[ALERTA] Has sido invitado a la sala ${roomJid}`)
      
        const presenceStanza = xml(
          'presence',
          { to: roomJid + '/' + xmpp.jid.local },
          xml('x', { xmlns: 'http://jabber.org/protocol/muc' })
        )
        xmpp.send(presenceStanza)
        console.log(`[EXITO] Te has unido a la sala ${roomJid}`)
      }
      // Manejar mensajes 1 a 1
      else if (stanza.is('message') && stanza.attrs.type === 'chat' && stanza.getChild('body')) {
        const from = stanza.attrs.from
        const message = stanza.getChildText('body')
        // Verificar si es un archivo
        const isFile = message.includes('file://') 
        if (isFile) {
          const fileData = message.split('//')[2]
          const extension = message.split('//')[1].split(':')[0]
          const decodedFileData = Buffer.from(fileData, 'base64')
          const fileName = `${from.split('@')[0]}-${Date.now()}.${extension}`
          const directoryPath = path.join(__dirname, './recibidos');
          // Crear el directorio si no existe
          if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
          }
          //guardalectorLineao en ./recibidos
          fs.writeFileSync(path.join(__dirname,`./recibidos/${fileName}`), decodedFileData)
          console.log(` Nuevo archivo de ${from}: ${fileName}`)
        }else{

          console.log(` Nuevo mensaje de ${from}: ${message}`)
        }} 
      // Manejar mensajes de grupo
      else if (stanza.is('message') && stanza.attrs.type === 'groupchat') {
        const from = stanza.attrs.from
        const roomJid = from.split('/')[0]  // Obtiene el JID de la sala sin el recurso (nombre del usuario)
        const senderNickname = from.split('/')[1]  // Obtiene el nickname del usuario que envió el mensaje
        const body = stanza.getChildText('body')
        
        if (body) {  // Verifica si realmente hay un cuerpo en el mensaje
            console.log(`[EXITO] Mensaje de ${senderNickname} en sala ${roomJid}: ${body}`)
        }}}
    // Manejo del loggin
    else if (stanza.is('presence') && stanza.attrs.from === xmpp.jid.toString() && stanza.attrs.type !== 'unavailable') {
      // Obtener el roster del usuario
      obtLista(xmpp,jid)
      console.log('[EXITOSO]', 'Successfully logged in')
      secondMenu()
    }
    // Manejo de la suscripcion
    else if (stanza.is('presence')){
      // Si es una presencia de un usuario agregar al roster
      if (stanza.attrs.type === 'subscribe'){
        console.log(` Solicitud de suscripcion de ${stanza.attrs.from}`)
        xmpp.send(xml('presence', { to: stanza.attrs.from, type: 'subscribed' }))
        console.log(` Has aceptado la solicitud de ${stanza.attrs.from}`)
        contacts[stanza.attrs.from] = {showMessage: '', status: 'Available'}
      }
      // Si es una presencia de un usuario aceptando la suscripcion
      else if (stanza.attrs.type === 'subscribed'){
        console.log(` El usuario ${stanza.attrs.from} ha aceptado tu solicitud de suscripcion`)
      }
      else if(!stanza.attrs.type){
        const contactJid = stanza.attrs.from.split('/')[0]
        if (contactJid !== xmpp.jid.bare().toString()) {  // Comprueba si el JID del contacto es diferente al tuyo
          console.log(`El usuario ${contactJid} esta en tu lista de contactos`)
          const showMessage = stanza.getChild('showMessage')?.getText()
          const status = stanza.getChild('status')?.getText()
          if (showMessage) {
            contacts[contactJid] = {...contacts[contactJid],showMessage}
          }else{
            contacts[contactJid] = {...contacts[contactJid],showMessage: ''}
          }if (status) {
            contacts[contactJid] = {...contacts[contactJid],status: statusColor[status]}
          }else{
            contacts[contactJid] = {...contacts[contactJid],status: 'Available'}
          }
        }
      }
      // Si es una presencia de un grupo agregar al roster del grupo
      if (stanza.getChild('x', 'http://jabber.org/protocol/muc#user')) {
        const local = {}
        const groupJid = stanza.attrs.from.split('/')[0]
        const groupRosterItems = stanza.getChild('x').getChildren('item')
        groupRosterItems.forEach((item) => {
          const contactJid = item.attrs.jid.split('/')[0]
          const showMessage = ""
          const status = "Available"
          console.log(`${contactJid} se ha unido al grupo ${groupJid}`)
          if (contactJid !== xmpp.jid.bare().toString() && !(contactJid in contacts)) { 
            contacts[contactJid] = {showMessage, status}
          }
          if (!(contactJid in local)){
            local[contactJid] = {showMessage, status}
          }
        })
        if (!(groupJid in groupRoster)){
          groupRoster[groupJid] = local
        }else{
          groupRoster[groupJid] = {...groupRoster[groupJid],...local}
        }
        
      }
    }
    // Para guardar el rouster
    else if (stanza.is('iq') && stanza.attrs.type === 'result' && stanza.getChild('query', 'jabber:iq:roster')) {
      const rosterItems = stanza.getChild('query').getChildren('item')
      rosterItems.forEach((item) => {
        const contactJid = item.attrs.jid
        const showMessage = ""
        const status = "Offline"
        if (contactJid !== xmpp.jid.bare().toString() && !(contactJid in contacts)) { 
          contacts[contactJid] = {showMessage, status}
        }
      })
    }
  })
  // Manejo de eventos
  xmpp.on('online', async (address) => {
    console.log('->', 'online as', address.toString())
    await xmpp.send(xml('presence'))
  })
  // Si el servidor nos envia un error
  xmpp.on('error',async (err) => {

    if (err.condition === 'not-authorized') {
      console.error('[ERROR] Autenticación fallida. Verifica tu ID de cuenta y contraseña.')
    } else {
      console.error('[ERROR]', err.toString())
    }
    menu()
  })
  // Si nos desconectamos
  xmpp.on('offline', () => {
    console.log('', 'offline')
    menu()
  })
  // Nos conectamos al servidor
  xmpp.start().catch(() =>{})
}
// Funcion para eliminar una cuenta del servidor
async function elimincarCuent(jid, password) {
  try {
    const xmpp = client({
      service: 'xmpp://alumchat.xyz:5222',
      domain: 'alumchat.xyz',
      username: jid,
      password: password,
      terminal: true,
    });
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    xmpp.on('stanza', async (stanza) => {
      if (stanza.is('iq') && stanza.attrs.type === 'result') {
        console.log('[EXITOSO]', 'Cuenta eliminada con éxito');
      }
    });

    xmpp.on('error', (err) => {
      console.error('[ERROR]', err.toString());
    });

    xmpp.on('online', async () => {
      console.log('->', 'Conectado como', xmpp.jid.toString(), '\n');

      const deleteStanza = xml(
        'iq',
        { type: 'set', id: 'delete1' },
        xml('query', { xmlns: 'jabber:iq:regi' }, xml('remove'))
      );

      try {
        await xmpp.send(deleteStanza);
      } catch (err) {
        console.log(err);
      } finally {
        await xmpp.stop();
      }
    });

    xmpp.on('offline', () => {
      xmpp.stop();
      console.log('', 'Desconectado');
      menu();
    });

    await xmpp.start();
  } catch (error) {
    console.error(`[ERROR] Error en la función elimincarCuent: ${error.message}`);
    menu();
  }
}