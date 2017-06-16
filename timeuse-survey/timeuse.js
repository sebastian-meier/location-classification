const v8 = require('v8')
v8.setFlagsFromString('--max_old_space_size=4096')
v8.setFlagsFromString('--max_executable_size=4096')

var fs = require('fs')

if(process.argv.length < 4){
  console.log('Please provide path to time use survey data file (uktus15_diary_wide.tab) and output path.')
  process.exit()
}

for(let i = 3; i<4; i++){
  if(process.argv[i].substr(-1,1) != '/'){ 
    process.argv[i] += '/' 
  }
}

//Check if output folder exists
if (!fs.existsSync(process.argv[3])) {
  fs.mkdirSync(process.argv[3]);
}

var labels = {
  11 : 'Home',
  12 : 'Home',
  13 : 'Work',
  14 : 'OtherHome',
  15 : 'Food',
  16 : 'Leisure',
  17 : 'Leisure',
  18 : 'Leisure',
  19 : 'Shopping',
  30 : 'Transport',
  31 : 'Transport',
  32 : 'Transport',
  33 : 'Transport',
  34 : 'Transport',
  35 : 'Transport',
  36 : 'Transport',
  37 : 'Transport',
  38 : 'Transport',
  39 : 'Transport',
  40 : 'Transport',
  41 : 'Transport',
  42 : 'Transport',
  43 : 'Transport',
  44 : 'Transport',
  45 : 'Transport',
  46 : 'Transport',
  47 : 'Transport',
  48 : 'Transit',
  9999 : 'NA'
}

var includeNA = false

var types = [], type_keys = {}

for(var l in labels){
  if(!(labels[l] in type_keys)){
    type_keys[labels[l]] = true
    types.push(labels[l])
  }
}

//uktus15_diary_wide.tab
var data = (fs.readFileSync(process.argv[2], 'utf8')).split('\n')

var c_data = [], c_data24 = '',
  location_json = {week : [], wsat : [], wsun : [], weekend : []},
  activity_json = {week : [], wsat : [], wsun : [], weekend : []}

//fill json with empty data
for(var type in location_json){
  for(var i = 1; i<=144; i++){
    var obj = {}

    types.forEach(function(t){
      obj[t] = 0
    })

    location_json[type].push(obj)
  }
}

//find the where columns in the title column, 144 > every ten minutes and the weekend/weekday column 1 > week, 2 > sat, 3 > sun
var where_cols = {}, week_col = false
var c = data[0].split('\t')
c.forEach(function(d,i){
  if(d.indexOf('wher_')>=0){
    var m = d.split('_')
    where_cols[parseInt(m[1])] = i
  }else if(d.indexOf('ddayw')>=0){
    week_col = i
  }
})

data.forEach(function(d, i){
  if(i>0){
    var vars = d.split('\t')
    var type = parseInt(vars[week_col])
    var wtype = false
    switch(type){
      case 1: wtype = 'week'; break;
      case 2: wtype = 'wsat'; break;
      case 3: wtype = 'wsun'; break;
    }
    if(wtype){
      var temp_where = []
      for(var col in where_cols){
        var key = 'NA';
        if(vars[where_cols[col]] in labels){
         key =  labels[vars[where_cols[col]]]
        }

        temp_where.push(key)

        location_json[wtype][parseInt(col)-1][key]++
        if(wtype == 'wsat' || wtype == 'wsun'){
          location_json['weekend'][parseInt(col)-1][key]++
        }

      }

      var current_where = temp_where[0], temp_start = 0, first = true, prev_dd
      temp_where.forEach(function(dd,ii){
        if(current_where != dd){
          if(!first){
            build24(temp_start,(ii-1),prev_dd)
            if(!includeNA && prev_dd == 'NA'){
              //ignore
            }else{
              c_data.push([temp_start,(ii-1),((ii)-temp_start),prev_dd])
            }
          }
          first = false
          current_where = dd
          temp_start = ii
        }
        prev_dd = dd
      })

      //connect start and end
      if(current_where == temp_where[0]){
        current_where = temp_where[0]
        first = true
        temp_where.forEach(function(dd,ii){
          if(current_where != dd && first){
            if(!includeNA && prev_dd == 'NA'){
              //ignore
            }else{
              var csv = ''

              for(var a = 0; a<144; a++){
                if(a>0){
                  csv += ','
                }
                if(a<=(ii-1) || a>=(temp_start)){
                  csv += 1
                }else{
                  csv += 0
                }
              }
              csv += ','+prev_dd

              if(c_data24 != ''){
                c_data24 += '\n'
              }
              c_data24 += csv
              
              c_data.push([temp_start,(ii-1),((ii)+(temp_where.length-temp_start)),prev_dd])
            }
            first = false
          }
          prev_dd = dd
        })
      }else{
        build24(temp_start,(temp_where.length-1),prev_dd)
        if(!includeNA && current_where == 'NA'){
          //ignore
        }else{
          c_data.push([temp_start,temp_where.length-1,(temp_where.length-temp_start),current_where])
        }
        current_where = temp_where[0], first = true
        temp_where.forEach(function(dd,ii){
          if(current_where != dd && first){
            build24(0,ii-1,prev_dd)
            if(!includeNA && dd == 'NA'){
              //ignore
            }else{
              c_data.push([0,(ii-1),(ii),dd])
            }
            first = false
          }
        })
      }
    }
  }
})

fs.writeFileSync(process.argv[3]+'time-use.json', JSON.stringify(location_json));

function json2csv(json){
  var csv = ''
  json.forEach(function(d,i){
    if(i>0){
      csv += '\n'
    }
    d.forEach(function(dd,ii){
      if(ii>0){
        csv += ','
      }
      csv += dd
    })
  })
  return csv
}

function build24(start,end,prev_dd){
  if(!includeNA && prev_dd == 'NA'){
    //ignore
  }else{
    var csv = ''

    for(var a = 0; a<144; a++){
      if(a>0){
        csv += ','
      }
      if(a>=start && a<=end){
        csv += 1
      }else{
        csv += 0
      }
    }
    csv += ','+prev_dd

    if(c_data24 != ''){
      c_data24 += '\n'
    }
    c_data24 += csv
  }
}

fs.writeFileSync(process.argv[3]+'time-use.csv', json2csv(c_data));
fs.writeFileSync(process.argv[3]+'time-use-24.csv', c_data24);