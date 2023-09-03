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
```

### Status change

```javascript
const cambioEst = (xmpp, status, showMessage) => {
  // Código para cambiar el estado del usuario
}
```

### Contact Management

```javascript
const obtLista = (xmpp,jid) => { ... }
const limpContac = (contacts) => { ... }
const contacForm = async () => { ... }
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
function manejoOp(option) { ... }
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
const mandMensa = async (xmpp, contactJid, message) => { ... }
```

Parameters:
- xmpp: XMPP client connected to the server
- contactJid: JID of the recipient (it does not have the @server, only the username)
- message: Message to send

### Delete account

```javascript
async function eliminarCuent(jid, password) { ... }
```

Parameters:
- jid: JID of the user (it does not have the @servidor, only the username)
- password: Password

### Log in

#### Configure connection to the server

```javascript
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
