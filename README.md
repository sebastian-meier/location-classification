# location-classification
PhD #03 - Location analysis, classification and prediction

## Intro

The main purpose of this repository is to export data into CSVs, which can then be used for machine learning and predictions.

Export from sqlite for weka / tensorflow tests

## Usage

The first function creates the training data for the machine learning process (CSVs)

```
node index.js PATH_TO/DATABASE.db OUTPUT_PATH FILTERS
```
**PATH\_TO/DATABASE** (required): no .db extension
**OUTPUT\_PATH** (required): folder where the results should be saved to
**FILTERS** (optional): path to a json file, which contains filters (see filter.json as an example). This will limit the output to the contained ids and applies the tags as a type column.

Note: Many datasets are not well tagged, therefore, the filter is an easy way to generate a classification and apply it afterwards.

In addition to a full set, for each file there is also a filtered version where trip events occurs at least n-times (1-10).
The full dataset is also provided in segments (where 1 holds 1/10 of the data, 2 holds 2/10 of the data, n holds n/10 of the data), this can be used to compare predictions over time, as more training data is available.

### Time use Survey

A problem when using machine learning in a customisation process, you need user-data to train your models.
In the case of location classification, i tried overcoming this by using time use survey data. Time use surveys collect diaries in which people account for a 24 hour day what they are doing and where they are doing it in 10-minute intervals.

Many countries conduct these studies, great overview is provided here: https://www.timeuse.org/
I have been working with the UK data set (free if you register): https://discover.ukdataservice.ac.uk/series/?sn=2000054

```
node timeuse-survey/timeuse.js PATH_TO/uktus15_diary_wide.tab OUTPUT_PATH
```

The output can then be used to train a neural network for predicting location type, based on workday/weekend and time of the day. If one wants to be fancy, the survey also includes demographic data which could be used as a filter.

### Machine Learning

In my PhD I have been using three tools to test various machine learning techniques (sorted by complexity, performance and functionality):

1. TensorFlow (https://www.tensorflow.org/)
2. WEKA (http://www.cs.waikato.ac.nz/ml/weka/)
3. Convnet.JS (http://cs.stanford.edu/people/karpathy/convnetjs/)

While TensorFlow is an amazing framework, it is also has a steep learning curve and (if you are not lucky, like me) it can take a while to get it running on your machine.

If you are just starting, I strongly recommend WEKA. Its a bit older than the other two, BUT it has a GUI and can be installed as a standalone JAVA application.

Launch the explorer, pick one of the previously generated CSVs and go nuts on the machine learning techniques. I can recommend to start with a MultilayerPerceptron (10,20,10).

Try the limited CSVs, you will as limitation goes up, you will quickly see how the performance increases.

If you want do it more programmatically, I recommend Convnet.js while not as powerful as TensorFlow, you can do pretty amazing stuff and its in javascript and it works in node.js (yay), especially the Automatic example is helpful: http://cs.stanford.edu/people/karpathy/convnetjs/demo/automatic.html

An example of using the automatic/magicnet feature is provided in the convnet_magic folder.

Computing the magic network
```
cd convnet_magic
node magicnet.js
```
Testing the magic network
```
node convnet.js
```

### Tensorflow

A general note on the tensorflow examples. I am not a python person and its very likely python and me will never be friends. Nothing the less I wanted to use Tensorflow. So after I was able to setup my neural networks and tune everything and build myself a node.js script which generates a python script, which is then executed (via node.js) the output is collected and analysed (by node.js). Yes, i know that this is not very pretty, but it works for me.
In order to execute the commands below you need to have tensorflow installed on your system. Please check the tensorflow website: https://www.tensorflow.org/

#### Location type prediction

Activate TensorFlow
```
source ~/tensorflow/bin/activate
```
Run script
```
cd tensorflow
node tensorflow.js PATH_TO_LOCATION_DATA OUTPUT_PATH OPTIMZER TEST-TYPE DEBUG
```

**PATH\_TO\_LOCATION\_DATA** (required): the folder where the timeuse-survey files were saved to (see above)
**OUTPUT_PATH** (required): folder where the results should be saved to
**OPTIMZER** (required): Optimizer for the neural network: Ftrl, RMSProp, Adam, Adagrad, SGD, Momentum 
**TEST\_TYPE** (required): all, all\_limit, all\_train, filter, filter\_limit, filter\_train > limit and train further more expect 1-10 > e.g. all_limit-5
**DEBUG** (optional): TRUE/FALSE / default: FALSE


Note: Building the network can take a while...

#### Location duration prediction



#### Time use survey

Activate TensorFlow
```
source ~/tensorflow/bin/activate
```
Run script
```
cd timeuse-survey
node time_use_tensor.js TIME_NODES OUTPUT_PATH OPTIMZER PATH_TO_TIME_USE_DATA_FOLDER DEBUG
```

**TIME\_NODES** (required): 24 or 2 - in which way should the time be handled 24 means 24 binary fields for each hour of the day, 2 means start and end time (i recommend the latter)
**OUTPUT_PATH** (required): folder where the results should be saved to
**OPTIMZER** (required): Optimizer for the neural network: Ftrl, RMSProp, Adam, Adagrad, SGD, Momentum 
**PATH\_TO\_TIME\_USE\_DATA\_FOLDER** (required): the folder where the timeuse-survey files were saved to (see above)
**DEBUG** (optional): TRUE/FALSE / default: FALSE

Note: Building the network can take a while...
