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

// Iconos para los shows de los Usuarios
const showIcon = {
  'away': '🟠Away',
  'xa': '🟡Extended away',
  'dnd': '⛔Do not disturb',
  'chat': '🟢Available',
  'unavailable': '⚪Offline',
  
}

// Interfaz para leer la entrada del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Menu principal para el usuario
function menu() {
  console.log('1) Registrar una nueva cuenta en el servidor')
  console.log('2) Iniciar sesión con una cuenta')
  console.log('3) Eliminar la cuenta del servidor')
  console.log('4) Salir del programa')
  rl.question('\nElige una opción: ', (answer) => {
    handleMenuOption(answer)
  })
}

// Funcion para cambiar el estado y show del usuario
const cambiarEstadoUsuario = (xmpp, show, status) => {
  try {
    const presenceStanza = xml(
      'presence',
      {},
      xml('show', {}, show), // estado como 'chat', 'away', 'dnd', etc.
      xml('status', {}, status) // mensaje opcional, por ejemplo, "En una reunión"
    )

    xmpp.send(presenceStanza)
    console.log(`💭 Estado cambiado a ${show} con status ${status}`)
  } catch (error) {
    console.error(`❌ Error al cambiar el estado y show del usuario: ${error.message}`)
  }
}

// Funcion para obtener el roster del usuario
const getRoster = (xmpp,jid) => {
  const rosterQuery = xml('iq', { type: 'get', to:`${jid}@alumchat.xyz`}, xml('query', { xmlns: 'jabber:iq:roster' }))
  xmpp.send(rosterQuery)
}

// Funcion para limpiar el roster al cerrar sesion
const cleanContacts = () => {
  for (const contact in contacts) {
    delete contacts[contact]
  }
}

// Funcion para dar formato a los contactos al mostrarlos en el CLI
const formatContacts = async () => {
  if (contacts.length === 0) {
    console.log('No tienes contactos')
  }else{
    
    console.log('Contactos:') 
    console.log('\tJID    \t Show    \t Estado')
    for (const contact in contacts) {
      const isGroup = contact.includes('@conference.alumchat.xyz')
      const contactJid = contact.split('@')[0]

      if (isGroup) {
        // Obtener el rouster del group y mostrarlo
        
        const grupRost = groupRoster[contact]
        console.log(`=> ${contactJid}: ${Object.keys(grupRost).length} miembros`)
        if (grupRost) {
          for (const contact in grupRost) {
            const contactJid = contact.split('@')[0]
            console.log(`\t--> ${contactJid}: ${grupRost[contact].show } \t(${grupRost[contact].status? grupRost[contact].status : 'sin estado'})`)
          }
        }
        continue
      }

      //print sin tanbulacion
      if (contactJid.length > 10) {
        console.log(`=> ${contactJid}: ${contacts[contact].show } \t(${contacts[contact].status? contacts[contact].status : 'sin estado'})`)
      }else if(contactJid.length < 7){
        console.log(`=> ${contactJid}:\t\t ${contacts[contact].show } \t(${contacts[contact].status? contacts[contact].status : 'sin estado'})`)
  
      }
      
      else{
        console.log(`=> ${contactJid}:\t ${contacts[contact].show } \t(${contacts[contact].status? contacts[contact].status : 'sin estado'})`)
  
      }
    }
  }
}




// Funcion para manejar las opciones del menu principal de acciones
function handleMenuOption(option) {
  switch (option) {
    case '1':
      rl.question('Introduce el nuevo ID para la cuenta: ', (jid) => {
        rl.question('Introduce la contraseña para la cuenta: ', (password) => {
          register(jid, password)
        })
      })
      break
    case '2':
      
      rl.question('Introduce el ID para la cuenta: ', (jid) => {
        rl.question('Introduce la contraseña para la cuenta: ', (password) => {

          login(jid, password)

        })
      })
      break
      
    case '3':
      rl.question('Introduce el ID para la cuenta: ', (jid) => {
        rl.question('Introduce la contraseña para la cuenta: ', (password) => {
          deleteAccount(jid, password)
        })
      })
      break
    case '4':
      console.log('Saliendo del programa...')
      rl.close()
      process.exit(0)

    default:
      console.log('Opción no válida. Por favor, elige una opción válida.')
      menu()
  }
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



menu()
