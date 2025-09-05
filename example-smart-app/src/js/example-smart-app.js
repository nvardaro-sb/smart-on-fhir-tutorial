(function(window){
  window.extractData = async function() {
    console.log('🚀 Starting modern FHIR data extraction...');
    
    try {
      // Use modern FHIR client to get authenticated client
      const client = await FHIR.oauth2.ready();
      console.log('✅ FHIR client ready:', client);
      
      if (!client.patient) {
        throw new Error('No patient context available');
      }
      
      // Get patient data
      console.log('📥 Fetching patient data...');
      const patient = await client.patient.read();
      console.log('👤 Patient data:', patient);
      
      // Get observations - use modern client request method
      console.log('📊 Fetching observations...');
      const observationsQuery = 'Observation?code=' + encodeURIComponent([
        'http://loinc.org|8302-2',  // Height
        'http://loinc.org|8462-4',  // Diastolic BP
        'http://loinc.org|8480-6',  // Systolic BP
        'http://loinc.org|2085-9',  // HDL
        'http://loinc.org|2089-1',  // LDL
        'http://loinc.org|55284-4'  // Blood Pressure
      ].join(',')) + '&_sort=-date&_count=20';
      
      const observations = await client.patient.request(observationsQuery);
      console.log('📊 Observations:', observations);
      
      // Process the data using modern approach
      const processedData = processPatientData(patient, observations);
      console.log('✅ Processed data:', processedData);
      
      return processedData;
      
    } catch (error) {
      console.error('❌ Error in extractData:', error);
      console.error('Error occurred at:', new Date().toISOString());
      console.error('Current URL:', window.location.href);
      throw error;
    }
  };

  function processPatientData(patient, observations) {
    // Process patient name (handle both FHIR R4 string and older array formats)
    let fname = '';
    let lname = '';
    
    console.log('Patient name structure:', patient.name);
    if (patient.name && patient.name.length > 0) {
      const name = patient.name[0];
      
      // Handle given names
      if (Array.isArray(name.given)) {
        fname = name.given.join(' ');
      } else if (typeof name.given === 'string') {
        fname = name.given;
      }
      
      // Handle family names  
      if (Array.isArray(name.family)) {
        lname = name.family.join(' ');
      } else if (typeof name.family === 'string') {
        lname = name.family;
      }
    }

    // Create a lookup function for observations by code
    function findObservationsByCode(observations, codeSystem, code) {
      if (!observations.entry) return [];
      
      return observations.entry
        .map(entry => entry.resource)
        .filter(obs => 
          obs.code && obs.code.coding && 
          obs.code.coding.some(coding => 
            coding.system === codeSystem && coding.code === code
          )
        );
    }

    // Find specific observations
    const heightObs = findObservationsByCode(observations, 'http://loinc.org', '8302-2');
    const bpObs = findObservationsByCode(observations, 'http://loinc.org', '55284-4');
    const hdlObs = findObservationsByCode(observations, 'http://loinc.org', '2085-9');
    const ldlObs = findObservationsByCode(observations, 'http://loinc.org', '2089-1');

    // Get blood pressure values
    const systolicbp = getBloodPressureValue(bpObs, '8480-6');
    const diastolicbp = getBloodPressureValue(bpObs, '8462-4');

    return {
      fname: fname,
      lname: lname,
      gender: patient.gender || '',
      birthdate: patient.birthDate || '',
      height: getQuantityValueAndUnit(heightObs[0]) || '',
      systolicbp: systolicbp || '',
      diastolicbp: diastolicbp || '',
      hdl: getQuantityValueAndUnit(hdlObs[0]) || '',
      ldl: getQuantityValueAndUnit(ldlObs[0]) || ''
    };
  }

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
  };

})(window);
