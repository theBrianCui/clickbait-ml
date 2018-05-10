# clickbait-ml

This project stores the code and dataset used for the paper "Detecting Clickbait Hyperlinks Using Deep Learning" by Brian Cui and Akshay Gupta for the course CS 388 Natural Language Processing at the University of Texas at Austin. The paper is contained in this repository as `paper.pdf`. The project was written in Tensorflow on Python 2.

To test and train our model, you'll need the Google word2vec pretrained word embeddings: https://drive.google.com/file/d/0B7XkCwpI5KDYNlNUTTlSS21pQmM/edit

The web scraper and instructions for using it are stored in the `scraper` directory. The datasets we collected are available in the `dataset` directory.

## Results

Raw test results can be found in the `test*.out` files, each numbered with the assigned maximum length hyperparameter. Charts (images) can be found in the `graphs` directory.

## Usage

To train the model, run

```
python model/pos_bilstm.py <clickbait set> <nonclickbait set> <training directory> train <path to word2vec embeddings> [maximum length=20]
```

An example bulk run script is available in `train_bulk.sh`.

To test the model after training,

```
python model/pos_bilstm.py <clickbait set> <nonclickbait set> <training directory> test <path to word2vec embeddings> [maximum length=20]
```

An example bulk test script is available in `test_bulk.sh`.
