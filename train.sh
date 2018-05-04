rm -rf "$1"
mkdir -p "$1"
python -u model/pos_bilstm.py dataset/clickbait.in dataset/non_clickbait.in "$1" train "$2" > "$3" 2>&1
