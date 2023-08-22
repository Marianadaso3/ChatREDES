# ChatREDES

This project implements an XMPP based chat client. Important aspects of functionality are described below.

## Requirements

- NodeJS version 18.16.1
- NPM version 9.5.1
- Bibliotecas de NodeJS:
  - @xmpp/client
  - @xmpp/debug
  - fs
  - path
  - net
  - readline

  
## Settings

Clone the project using the following commands from console

```bash
git clone https://github.com/Marianadaso3/ChatREDES.git
cd Proyecto1_Redes
```
Install the dependencies

```bash
npm install
```
Run Client

```bash
npm run dev
```


## Main Functions

### Main menu

```javascript
function menu() {
  console.log('1) Registrar una nueva cuenta en el servidor')
  console.log('2) Iniciar sesión con una cuenta')
  console.log('3) Eliminar la cuenta del servidor')
  console.log('4) Salir del programa')
  rl.question('\nElige una opción: ', (answer) => {
    handleMenuOption(answer)
  })
}
```

### Status change

```javascript
const cambiarEstadoUsuario = (xmpp, show, status) => {
  // Código para cambiar el estado del usuario
}
```

### Contact Management

```javascript
const getRoster = (xmpp,jid) => { ... }
const cleanContacts = () => { ... }
const formatContacts = async () => { ... }
```

Parameters:
- xmpp: XMPP client connected to the server
- jid: JID of the user (it does not have the @server only the username)

### Read and Send Files

```javascript
const leerArchivo = async (xmpp,path,toJid) => { ... }
```

Parameters:
- xmpp: XMPP client connected to the server
- path: Path of the file to send
- toJid: JID of the recipient (it does not have the @server, only the username)

### Menu Options

```javascript
function handleMenuOption(option) { ... }
```
### User Registration

```javascript
async function register(username, password) { ... }
```
### Creation and Joining Rooms

```javascript
const crearRoom = async (xmpp, roomName) => { ... }
const unirseRoom = async (xmpp, roomName) => { ... }
```
Parameters:
- xmpp: XMPP client connected to the server
- roomName: Name of the chat room (this does not have the @conference, only the name of the room)

### Send messages

```javascript
const sendMessages = async (xmpp, contactJid, message) => { ... }
```

Parameters:
- xmpp: XMPP client connected to the server
- contactJid: JID of the recipient (it does not have the @server, only the username)
- message: Message to send

### Delete account

```javascript
async function deleteAccount(jid, password) { ... }
```

Parameters:
- jid: JID of the user (it does not have the @servidor, only the username)
- password: Password

### Log in

#### Configure connection to the server

```javascript
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
}
```

```javascript

  xmpp.on('stanza', async (stanza) => {
    if (stanza.is('message')) {   
      // Manejo de mensajes
    }
    
    else if (stanza.is('presence') && stanza.attrs.from === xmpp.jid.toString() && stanza.attrs.type !== 'unavailable') {
      /// Manejo del loggin
    }
    
    else if (stanza.is('presence')){
      // Manejo de la suscripcion
    }
      
    if (stanza.getChild('x', 'http://jabber.org/protocol/muc#user')) {
        // Si es una presencia de un grupo agregar al roster del grupo
    }

    
    else if (stanza.is('iq') && stanza.attrs.type === 'result' && stanza.getChild('query', 'jabber:iq:roster')) {
      // Para guardar el rouster
    }

  })

  // Manejo de casos
  xmpp.on('online', async (address) => {
    console.log('online as', address.toString())
    await xmpp.send(xml('presence'))
  })

  // Error del servidor
  xmpp.on('error',async (err) => {

    if (err.condition === 'not-authorized') {
      console.error('ERROR: Autenticación fallida. Verifica tu ID de cuenta y contraseña.')
    } else {
      console.error(err.toString())
    }
    menu()
  })

  // Desconectar
  xmpp.on('offline', () => {
    console.log('offline')
    menu()
  })

```

In this section, the events that can occur during the connection with the XMPP server are managed. They are all the listeners that can occur during the connection with the XMPP server and basically the ones that will be giving the user information about what is happening in the chat.