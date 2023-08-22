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




menu()
