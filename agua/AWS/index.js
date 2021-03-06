const awsIoT = require('aws-iot-device-sdk')

const Leitura = require('./src/model/leitura')

const express = require('express')

const app = express()

const handlebars = require('express-handlebars')

const path = require('path')

const { DateTime } = require('luxon')

const credentials = require('./config/googlesheetseletricidade.json')

const GoogleSpreadsheet  = require('google-spreadsheet')

const { promisify } = require('util')

const accessSheet = async(docId, time, fluxoAgua, volumeTotal) => {
    const doc = new GoogleSpreadsheet(docId)
  
    await promisify(doc.useServiceAccountAuth)(credentials)
    const info = await promisify(doc.getInfo)()
    const worksheet = info.worksheets[0]
    await promisify(worksheet.addRow)({time, fluxoAgua, volumeTotal})
  } 

app.use(express.static(path.join(__dirname, "public")))

app.engine('handlebars', handlebars({defaultLayout: 'main'}))
app.set('view engine', 'handlebars')

const device = awsIoT.device ({
    keyPath: "cert.key",
    certPath: "cert.pem",
    caPath: "ca.pem",
    ClientId: "iotconsole-1603056348568-14",
    host: "ahmwfortxjjfp-ats.iot.us-east-1.amazonaws.com"
})

function connectaws(){
    device.on("connect",()=>{
        console.log("Conectado AWS")
        device.subscribe("ESP3CasaTiosA/pub")
        device.publish("ESP3CasaTiosA/pub",JSON.stringify({ confirm: 'online' }))
    })
}

connectaws()

device.on("error",()=>{
    console.log("Erro na conexão com AWS")
    connectaws()
})


device.on("message", async(topic, payload)=>{
    
    const {time,fluxoAgua,volumeTotal} = await JSON.parse(payload)
    //const leituras = await JSON.parse(payload.toString())
    
    //console.log({leituras})
    //console.log(await JSON.parse(payload))
    if (fluxoAgua == undefined || volumeTotal == undefined) {
        return false
    }

    console.log({time,fluxoAgua,volumeTotal})

    await Leitura.create({fluxoAgua, volumeTotal, type:"agua", time})

    accessSheet ('1vbh6Ervqg2WIEwHPai12Ret9XM64FnwvhILjjNzo63Q', DateTime.local().setZone('America/Sao_Paulo'), fluxoAgua, volumeTotal)

})

app.get('/monitoragua', async(req, res) => {
    const agua = await Leitura.find({type: 'agua'}).sort({time: 'desc'}).limit(1)

    agua.forEach(function(agua){

        res.render(__dirname + '/views/layouts/grafico', {volume: agua.volumeTotal})
    })
})


  app.listen(3001,()=>{
      console.log("Servidor Agua Conectado")
  })
