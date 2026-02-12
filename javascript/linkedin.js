let scrapper = {
    scrape: function() {
        const output = {}
        output.job_title = document.querySelector('h1 a').textContent
        output.company_name = document.querySelector('div[class*=company-name] a').textContent

        const url = new URL(document.querySelector('h1 a').href)
        url.search = ''
        output.url = String(url)

        descriptions = document.querySelector('div[class*=description] span')
            .textContent.split('·').map(x=>x.trim())

        output.location = descriptions[0]
        output.publication = this.calcularFecha(descriptions[1])
        output.description = document.querySelector('[class*=jobs-description__content]').textContent
        
        return output
    },
    toCSV: function(myObject) {
        return ["company_name", "job_title", "location", "url", "publication"]
            .map(x=>myObject[x]).join(';')
    },
    calcularFecha: function(texto) {
      const now = new Date();
      const match = texto.match(/(\d+)\s+(día|días|day|days|mes|meses|hora|horas)/i);
    
      if (!match) return now.toISOString();
    
      const cantidad = parseInt(match[1], 10);
      const unidad = match[2].toLowerCase();
    
      switch (unidad) {
        case "hora":
        case "horas":
          now.setHours(now.getHours() - cantidad);
          break;
    
        case "día":
        case "días":
        case "days":
        case "day":
          now.setDate(now.getDate() - cantidad);
          break;
    
        case "mes":
        case "meses":
          now.setMonth(now.getMonth() - cantidad);
          break;
      }
    
      return now.toISOString();
    },
    run: function() {
        myObject = this.scrape()
        output = this.toCSV(myObject)
        return output
    }
}

scrapper.run()