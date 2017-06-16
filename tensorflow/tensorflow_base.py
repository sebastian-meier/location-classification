from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import os

# ignore the warning for including GPU usage
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import sys

import urllib

import numpy as np
import tensorflow as tf
import pandas as pd

# Data sets
TIME_TRAINING = sys.argv[1]

TIME_TEST = sys.argv[2]

COLUMNS = %COLUMNS%
CATEGORICAL_COLUMNS = %CATCOLUMNS%
CONTINUOUS_COLUMNS = %CCOLUMNS%
LABEL_COLUMN = %LABEL%

# Load datasets.
df_train = pd.read_csv(TIME_TRAINING, names=COLUMNS, skipinitialspace=True)
df_test = pd.read_csv(TIME_TEST, names=COLUMNS, skipinitialspace=True)

%COLUMNDEFS%

feature_columns = [%COLUMNFEATURES%]

def input_fn(df, train=False): #, train=False
  """Input builder function."""
  # Creates a dictionary mapping from each continuous feature column name (k) to
  # the values of that column stored in a constant Tensor.
  continuous_cols = {k: tf.constant(df[k].values) for k in CONTINUOUS_COLUMNS}
  # Creates a dictionary mapping from each categorical feature column name (k)
  # to the values of that column stored in a tf.SparseTensor.
  categorical_cols = {k: tf.SparseTensor(
    indices=[[i, 0] for i in range(df[k].size)],
    values=df[k].values,
    dense_shape=[df[k].size, 1])
      for k in CATEGORICAL_COLUMNS}

  # Merges the two dictionaries into one.
  feature_cols = dict(continuous_cols)
  feature_cols.update(categorical_cols)
  # Converts the label column into a constant Tensor.
  if train:
    label = tf.constant(df[LABEL_COLUMN].values)
    # Returns the feature columns and the label.
    return feature_cols, label
  else:
    # so we can predict our results that don't exist in the csv
    return feature_cols

# Build 3 layer DNN with 10, 20, 10 units respectively.
#LinearRegressor(feature_columns=feature_columns)
classifier = tf.contrib.learn.DNNClassifier(feature_columns=feature_columns,
                                            hidden_units=[%HIDDENUNITS%],
                                            n_classes=%CLASSES%,
                                            optimizer="%OPTIMIZER%") #Ftrl, RMSProp, Adam, Adagrad, SGD, Momentum

#,model_dir="/tmp/time_use"

# Fit model.
classifier.fit(input_fn=lambda: input_fn(df_train, True), steps=2000)

# Evaluate accuracy.
evaluation = classifier.evaluate(input_fn=lambda: input_fn(df_test, True),
                                     steps=1)

accuracy_score = evaluation["accuracy"]

# print(evaluation)
print("\nTest Accuracy: {0:f}\n".format(accuracy_score))

# Classify two new flower samples.
def new_samples():
   na = np.array(%NEW_SAMPLES%, dtype=np.int)
   df = pd.DataFrame(na, columns=%COLUMNS%)
   return input_fn(df)

predictions = list(classifier.predict(input_fn=new_samples)) #.predict_proba(..)

print(
   "New Samples, Class Predictions:    {}\n"
   .format(predictions))