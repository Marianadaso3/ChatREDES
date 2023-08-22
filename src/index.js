const { client, xml, jid } = require("@xmpp/client")
const fs = require('fs')
const path = require('path')
const net = require('net')
const debug = require("@xmpp/debug")
const readline = require('readline')
const contacts = {}
const groupRoster = {}
const registerState = {successfulRegistration: false } 
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
      handleMenuOption(answer);
    });
}

// Funcion para limpiar el roster al cerrar sesion
const cleanContacts = (contacts) => {
    Object.keys(contacts).forEach((contact) => {
      delete contacts[contact];
    });
  };



// Funcion para obtener el roster (lista de contactos) del usuario
const getRoster = (xmpp,jid) => {
  const rosterQuery = xml('iq', { type: 'get', to:`${jid}@alumchat.xyz`}, xml('query', { xmlns: 'jabber:iq:roster' }))
  xmpp.send(rosterQuery)
}


// Funcion para dar formato a los contactos al mostralectorLineaos en el CLI
const formatContacts = async () => {
  if (contacts.length === 0) {
    console.log('No tienes contactos')
  }else{
    
    console.log('Contactos:') 
    console.log('\tJID    \t status    \t status')
    for (const contact in contacts) {
      const isGroup = contact.includes('@conference.alumchat.xyz')
      const contactJid = contact.split('@')[0]

      if (isGroup) {
        // Obtener el rouster del group y mostralectorLineao
        
        const grupRost = groupRoster[contact]
        console.log(`=> ${contactJid}: ${Object.keys(grupRost).length} miembros`)
        if (grupRost) {
          for (const contact in grupRost) {
            const contactJid = contact.split('@')[0]
            console.log(`\t--> ${contactJid}: ${grupRost[contact].status } \t(${grupRost[contact].showMessage? grupRost[contact].showMessage : 'sin status'})`)
          }
        }
        continue
      }

      //print sin tanbulacion
      if (contactJid.length > 10) {
        console.log(`=> ${contactJid}: ${contacts[contact].status } \t(${contacts[contact].showMessage? contacts[contact].showMessage : 'sin status'})`)
      }else if(contactJid.length < 7){
        console.log(`=> ${contactJid}:\t\t ${contacts[contact].status } \t(${contacts[contact].showMessage? contacts[contact].showMessage : 'sin status'})`)
  
      }
      
      else{
        console.log(`=> ${contactJid}:\t ${contacts[contact].status } \t(${contacts[contact].showMessage? contacts[contact].showMessage : 'sin status'})`)
  
      }
    }
  }
}

// Funcion para cambiar el status y status del usuario
const changeState = (xmpp, status, showMessage) => {
    try {
      const presenceStanza = xml(
        'presence',
        {},
        xml('status', {}, status), // status como 'away', 'dnd', etc.
        xml('showMessage', {}, showMessage) // mensaje de estado
      )
  
      xmpp.send(presenceStanza)
      console.log(`\x1b[32m ¡status cambiado EXITOSAMENTE a \x1b[0m ${status} \x1b[32m con showMessage \x1b[0m ${showMessage}`)
    } catch (error) {
      console.error(`\x1b[31m [ERROR] El status no pudo ser cambiado (intente de nuevo):\x1b[0m ${error.message}`)
    }
  }
  

// Funcion para leer el archivo y envialectorLineao
const leerArchivo = async (xmpp,path,toJid) => {
  try{
  
    const extension = path.split('.').pop()
    
    const fileData = await fs.readFileSync(path)
    const encodedFileData = Buffer.from(fileData).toString('base64')
    const message = `file://${extension}://${encodedFileData}` // se crea el mensaje
    
    sendMessages(xmpp, toJid, message)
    return
  }
  catch(err){
    console.log('[ERROR] El archivo adjuntado no existe. Porfavor, verifique que el input sea correcto.')
    return
  }
}

// Funcion para manejar las opciones del menu principal de acciones
function handleMenuOption(option) {
  switch (option) {
    case '1':
      lectorLinea.question('Introduce el nuevo ID para la cuenta: ', (jid) => {
        lectorLinea.question('Introduce la contraseña para la cuenta: ', (password) => {
          register(jid, password)
        })
      })
      break
    case '2':
      
      lectorLinea.question('Introduce el ID para la cuenta: ', (jid) => {
        lectorLinea.question('Introduce la contraseña para la cuenta: ', (password) => {

          login(jid, password)

        })
      })
      break
      
    case '3':
      lectorLinea.question('Introduce el ID para la cuenta: ', (jid) => {
        lectorLinea.question('Introduce la contraseña para la cuenta: ', (password) => {
          deleteAccount(jid, password)
        })
      })
      break
    case '4':
      console.log('Saliendo del programa...')
      lectorLinea.close()
      process.exit(0)

    default:
      console.log('Opción no válida. Por favor, elige una opción válida.')
      menu()
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
async function register(username, password) {
  
  // Se usa un socket de net para registrar la cuenta
  const client = new net.Socket()
  client.connect(5222, 'alumchat.xyz', function() {
    console.log('Connected')
    client.write('<stream:stream to="' + 'alumchat.xyz' + '" xmlns="jabber:client" xmlns:stream="http://etherx.jabber.org/streams" version="1.0">')
  })

  // Se verifica el usuario y se envia el registro
  client.on('data', function(data) {
    console.log('Received: ' + data)
    if (data.toString().includes('<stream:features>')) {
      client.write('<iq type="set" id="reg1"><query xmlns="jabber:iq:register"><username>' + username + '</username><password>' + password + '</password></query></iq>')
    } else if (data.toString().includes('iq type="result" id="reg1"')) {
      // El registro fue exitoso, procede con el inicio de sesión
      registerState.successfulRegistration = true
      client.destroy()
    } else if (data.toString().includes('<error code"409" type="cancel"><conflict xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>')) {
      // El usuario ya existe
      console.log('❌ El usuario ya existe, por favor elige un nombre de usuario diferente.')
      client.destroy()

    }
  })

  // Se cierra la conexion e inicia sesion si el registro fue exitoso
  client.on('close', function() {
    console.log('Connection closed')
    if (registerState.successfulRegistration) {
      console.log('Registro exitoso, iniciando sesión...\n\n')
      login(username, password)
    }
    else {
      // Si el registro no fue existoso, mostramos el menu de usuario
      menu()
    }
  })
}

// Funcion para crear una sala de chat
const crearRoom = async (xmpp, roomName) => {
  try {
    // Crear sala de chat
    const groupJid = `${roomName}@conference.alumchat.xyz/${xmpp.jid.local}`
    const groupStanza = xml('presence', { to: groupJid }, xml('x', { xmlns: 'http://jabber.org/protocol/muc' }))
    xmpp.send(groupStanza)

    // Configurar sala de chat como abierta
    const configRequest = xml('iq', { to: groupJid, type: 'set' }, 
      xml('query', { xmlns: 'http://jabber.org/protocol/muc#owner' }, 
        xml('x', { xmlns: 'jabber:x:data', type: 'submit' }, 
          xml('field', { var: 'muc#roomconfig_publicroom', type: 'boolean' }, 
            xml('value', {}, '1')
          )
        )
      )
    )

    xmpp.send(configRequest)
    console.log("👯 Sala de chat creada exitosamente y configurada como abierta")
  } catch (error) {
    console.log(`❌ Error al crear la sala de chat: ${error.message}`)
  }
}

// Funcion para unirse a una sala de chat
const unirseRoom = async (xmpp, roomName) => {
  try {
    const groupJid = `${roomName}@conference.alumchat.xyz/${xmpp.jid.local}`
    const groupStanza = xml('presence', { to: groupJid }, xml('x', { xmlns: 'http://jabber.org/protocol/muc' }))
    xmpp.send(groupStanza)
    console.log(`👯 Intentando unirse al grupo público ${roomName}`)
  } catch (error) {
    console.log(`❌ Error al unirse a la sala de chat: ${error.message}`)
  }
}

// Funcion para agregar un contacto con una stanza de presence
const addContact = async (xmpp, contactJid) => {
  try {
    const presenceStanza =  xml('presence', { to: `${contactJid}@alumchat.xyz`, type: 'subscribe' })
    await xmpp.send(presenceStanza)
    console.log('📨 Solicitud de contacto enviada a', contactJid)
  } catch (error) {
    console.log('❌ Error al agregar contacto', error)
  }
}

// Funcion para enviar mensajes
const sendMessages = async (xmpp, contactJid, message) => {
  try {
    const messageStanza = xml(
      'message',
      { type: 'chat', to: contactJid + '@alumchat.xyz' },
      xml('body', {}, message),
    )
    xmpp.send(messageStanza)
  } catch (error) {
    console.log('❌ Error al enviar mensaje', error)
  }
}

async function login(jid, password) {
  // Nos conectamos al servidor
  const xmpp = client({
    service: 'xmpp://alumchat.xyz:5222',
    domain: 'alumchat.xyz',
    username: jid, 
    password: password,
    // terminal: true,
  })

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  // debug(xmpp, true)

  // Funcion para mostrar el segundo menu de funciones
  const secondMenu = ()=> {

    console.log('\n')
    console.log('1) Mostrar todos los contactos y su status')
    console.log('2) Agregar un usuario a los contactos')
    console.log('3) Mostrar detalles de contacto de un usuario')
    console.log('4) Comunicación 1 a 1 con cualquier usuario/contacto')
    console.log('5) Participar en conversaciones grupales')
    console.log('6) Cambiar status y status')
    console.log('7) Enviar/recibir archivos')
    console.log('8) Cerrar sesion')
    lectorLinea.question('\nElige una opción: ',async (answer) => {
      await handleSecondMenuOption(answer)
    })
  }
  // Funcion para mostrar el menu de funciones de grupo
  const handleGroup = (option) => { 
    switch (option) {
      case '1':
        // Crear grupo
        lectorLinea.question('Introduce el nombre del grupo: ', (groupName) => {
          crearRoom(xmpp,groupName)
          secondMenu()
        })
        break
      case '2':
        // Enviar mensaje a grupo
        lectorLinea.question('Introduce el nombre del grupo: ', (groupName) => {
          lectorLinea.question('Introduce el mensaje que deseas enviar: ', (message) => {
            const groupJid = `${groupName}@conference.alumchat.xyz`
            const messageStanza = xml('message', { to: groupJid, type: 'groupchat' }, xml('body', {}, message))
            xmpp.send(messageStanza)
            secondMenu()
          })
        })
        break
      case '3':
        // Agregar usuario a grupo
        lectorLinea.question('Introduce el nombre del grupo: ', (groupName) => {
          lectorLinea.question('Introduce el JID del usuario que deseas agregar: ', (contactJid) => {
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
        lectorLinea.question('Introduce el nombre del grupo público al que deseas unirte: ', (groupName) => {
          unirseRoom(xmpp,groupName)
          secondMenu()
        })
        break
        
      
      default:
        console.log('❌ Opción no válida. Por favor, elige una opción válida.')
        secondMenu()
    }
  }
  
  // Funcion para manejar las opciones del menu de funciones
  const handleSecondMenuOption = async(option) => {
    switch (option) {
      case '1':
        //Mostar todos los contactos y su status
        formatContacts()
        secondMenu()
        break
      case '2':
        // Agregar un usuario a los contactos
        lectorLinea.question('Introduce el ID del usuario que deseas agregar: ',async (contactJid) => {
          addContact(xmpp, contactJid)
          secondMenu()
        })
        break
      case '3':
        // Mostrar detalles de contacto de un usuario
        lectorLinea.question('Introduce el JID del usuario del que deseas ver detalles: ', (contactJid) => {
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
        lectorLinea.question('Introduce el JID del usuario con el que deseas chatear: ', (contactJid) => {
          lectorLinea.question('Introduce el mensaje que deseas enviar: ', (message) => {
            sendMessages(xmpp, contactJid, message)
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
        lectorLinea.question('\n Introduce el status que deseas usar: ', (status) => {
          lectorLinea.question(' \n Introduce el mensaje de status que deseas usar (opcional): ', (showMessage) => {
            changeState(xmpp, status, showMessage)
            secondMenu()
          })
        })
        break
      case '7':
        // Enviar/recibir archivos
        lectorLinea.question('\n Introduce el JID del usuario al que deseas enviar un archivo: ', (contactJid) => {
          lectorLinea.question('\n Introduce la ruta del archivo que deseas enviar: ', async (filePath) => {
            await leerArchivo(xmpp,filePath,contactJid)
            secondMenu()
          })
        })
        break
      case '8':
        // Cerrar sesion
        await xmpp.send(xml('presence', {type: 'unavailable'}))
        await xmpp.stop()
        cleanContacts
        break
      default:
        console.log('❌ Opción no válida. Por favor, elige una opción válida.')
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
        console.log(`💌 Has sido invitado a la sala ${roomJid}`)
      
        const presenceStanza = xml(
          'presence',
          { to: roomJid + '/' + xmpp.jid.local },
          xml('x', { xmlns: 'http://jabber.org/protocol/muc' })
        )
        xmpp.send(presenceStanza)
        console.log(`👯 Te has unido a la sala ${roomJid}`)
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
          console.log(`📃 Nuevo archivo de ${from}: ${fileName}`)
        }else{

          console.log(`📥 Nuevo mensaje de ${from}: ${message}`)
        }
      } 
      // Manejar mensajes de grupo
      else if (stanza.is('message') && stanza.attrs.type === 'groupchat') {
        const from = stanza.attrs.from
        const roomJid = from.split('/')[0]  // Obtiene el JID de la sala sin el recurso (nombre del usuario)
        const senderNickname = from.split('/')[1]  // Obtiene el nickname del usuario que envió el mensaje
        const body = stanza.getChildText('body')
        
        if (body) {  // Verifica si realmente hay un cuerpo en el mensaje
            console.log(`👯 Mensaje de ${senderNickname} en sala ${roomJid}:📥 ${body}`)
        }
    }
    }
    // Manejo del loggin
    else if (stanza.is('presence') && stanza.attrs.from === xmpp.jid.toString() && stanza.attrs.type !== 'unavailable') {
      // Obtener el roster del usuario
      getRoster(xmpp,jid)
      console.log('🗸', 'Successfully logged in')
      secondMenu()
    }
    // Manejo de la suscripcion
    else if (stanza.is('presence')){
      // Si es una presencia de un usuario agregar al roster
      if (stanza.attrs.type === 'subscribe'){
        console.log(`🤗 Solicitud de suscripcion de ${stanza.attrs.from}`)
        xmpp.send(xml('presence', { to: stanza.attrs.from, type: 'subscribed' }))
        console.log(`🤗 Has aceptado la solicitud de ${stanza.attrs.from}`)
        contacts[stanza.attrs.from] = {showMessage: '', status: '🟢Available'}
      }
      // Si es una presencia de un usuario aceptando la suscripcion
      else if (stanza.attrs.type === 'subscribed'){
        console.log(`🤗 El usuario ${stanza.attrs.from} ha aceptado tu solicitud de suscripcion`)
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
          }
          if (status) {
            contacts[contactJid] = {...contacts[contactJid],status: statusColor[status]}
          }else{
            contacts[contactJid] = {...contacts[contactJid],status: '🟢Available'}
          }
          //contacts[contactJid] = {showMessage, status}
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
          const status = "🟢Available"
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
        const status = "⚪Offline"
        if (contactJid !== xmpp.jid.bare().toString() && !(contactJid in contacts)) { 
          contacts[contactJid] = {showMessage, status}
        }
      })
    }
  
  


  })

  // Manejo de eventos
  xmpp.on('online', async (address) => {
    console.log('▶', 'online as', address.toString())
    await xmpp.send(xml('presence'))
  })

  // Si el servidor nos envia un error
  xmpp.on('error',async (err) => {

    if (err.condition === 'not-authorized') {
      console.error('❌ Autenticación fallida. Verifica tu ID de cuenta y contraseña.')
    } else {
      console.error('❌', err.toString())
    }
    menu()
  })

  // Si nos desconectamos
  xmpp.on('offline', () => {
    console.log('⏹', 'offline')
    menu()
  })

  // Nos conectamos al servidor
  xmpp.start().catch(() =>{})

}

// Funcion para eliminar una cuenta del servidor
async function deleteAccount(jid, password) {

  // Nos conectamos al servidor 
  const xmpp = client({
    service: 'xmpp://alumchat.xyz:5222',
    domain: 'alumchat.xyz',
    username: jid, 
    password: password,
    terminal: true,
  })

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  
  xmpp.on('stanza', async (stanza) => {
    // si nos llega la estanza del result es que se ha eliminado la cuenta
    if (stanza.is('iq') && stanza.attrs.type === 'result') {
      console.log('🗸', 'Successfully deleted account')
      
    }
  })

  xmpp.on('error', (err) => {
    console.error('❌', err.toString())
  })

  xmpp.on('online', async () => {
    console.log('▶', 'online as', xmpp.jid.toString(), '\n')
    // creamos la estanza para eliminar la cuenta
    const deleteStanza = xml(
      'iq',
      { type: 'set', id: 'delete1' },
      xml('query', { xmlns: 'jabber:iq:register' }, xml('remove'))
    )
    try{

      await xmpp.send(deleteStanza)
    }
    catch(err){
      console.log(err)
    }finally{
      
      await xmpp.stop()
    }
  })
  // Nos desconectamos y volvemos al menu 
  xmpp.on('offline', () => {
    xmpp.stop()
    console.log('⏹', 'offline')

    menu()


  })

  xmpp.start().catch(() => {})
}



menu()
